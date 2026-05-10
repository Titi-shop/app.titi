import {
  guardPaymentForReconcile,
  acquirePaymentSettlementLock,
} from "@/lib/db/payments.guard";

import {
  auditDuplicateSubmit,
  auditManualReview,
  auditPiVerified,
  auditRpcFailed,
  auditRpcVerified,
  auditFinalizeDone,
  writePaymentAudit,
} from "@/lib/db/payments.audit";

import { verifyPiPaymentForReconcile } from "@/lib/db/payments.verify";
import { verifyRpcPaymentForReconcile } from "@/lib/db/payments.rpc";

import {
  finalizePaidOrderFromIntent,
  FinalizePaidOrderResult,
} from "@/lib/db/orders.payment";

import { SettlementLedgerV3 as SettlementLedger } from "@/lib/db/settlement.ledger";
import { piCompletePayment } from "@/lib/pi/client";

import type {
  RunPaymentSettlementInput,
  PaymentSettlementResult,
  RpcAuditResult,
} from "@/lib/payments/payment.types";

/* =========================================================
   RPC EMPTY
========================================================= */

function emptyRpc(): RpcAuditResult {
  return {
    ok: false,
    audited: false,
    amount: null,
    sender: null,
    receiver: null,
    ledger: null,
    confirmed: false,
    chainReference: null,
    stage: "UNSET",
    reason: "NOT_EXECUTED",
    payload: {},
  };
}

/* =========================================================
   RESULT
========================================================= */

const fail = (amount: number, source: string): PaymentSettlementResult => ({
  ok: false,
  orderId: null,
  amount,
  piCompleted: false,
  rpcAudited: false,
  source,
});

const success = (
  orderId: string,
  amount: number,
  rpcAudited: boolean,
  source: string
): PaymentSettlementResult => ({
  ok: true,
  orderId,
  amount,
  piCompleted: true,
  rpcAudited,
  source,
});

/* =========================================================
   RPC VERIFY (CORE)
========================================================= */

async function verifyRpcCore(
  paymentIntentId: string,
  piPaymentId: string,
  txid: string,
  source: string
): Promise<RpcAuditResult> {
  try {
    const rpc = await verifyRpcPaymentForReconcile({
      paymentIntentId,
      piPaymentId,
      txid,
    });

    if (rpc.ok) {
      await auditRpcVerified(paymentIntentId, {
        source,
        txid,
        amount: rpc.amount,
        ledger: rpc.ledger,
        receiver: rpc.receiver,
        sender: rpc.sender,
        chainReference: rpc.chainReference,
      });
    } else {
      await auditRpcFailed(paymentIntentId, {
        source,
        txid,
        reason: rpc.reason,
      });
    }

    return rpc;
  } catch (e) {
    await auditRpcFailed(paymentIntentId, {
      source,
      txid,
      reason: "RPC_EXCEPTION",
    });

    return emptyRpc();
  }
}

/* =========================================================
   PI COMPLETE (CORE)
========================================================= */

async function completePiCore(
  paymentIntentId: string,
  piPaymentId: string,
  txid: string,
  source: string
): Promise<boolean> {
  try {
    await piCompletePayment(piPaymentId, txid);

    await auditPiVerified(paymentIntentId, {
      source,
      piPaymentId,
      txid,
    });

    return true;
  } catch (e) {
    await auditManualReview(paymentIntentId, "PI_COMPLETE_FAILED", {
      source,
      txid,
      piPaymentId,
    });

    return false;
  }
}

/* =========================================================
   LEDGER (CORE ONLY)
========================================================= */

async function ledgerCore(
  paid: FinalizePaidOrderResult,
  paymentIntentId: string,
  piPaymentId: string,
  txid: string,
  rpc: RpcAuditResult
): Promise<boolean> {
  try {
    if (!paid.orderId) return false;

    const escrowId = await SettlementLedger.createEscrow({
      paymentIntentId,
      orderId: paid.orderId,
      buyerId: paid.buyerId,
      sellerId: paid.sellerId,
      amount: paid.amount,
      txid,
      piPaymentId,
    });

    await SettlementLedger.markPiVerified(escrowId);

    if (rpc.ok) {
      await SettlementLedger.markRpcVerified(escrowId);
    }

    await SettlementLedger.linkOrder(escrowId, paid.orderId);

    await SettlementLedger.creditSeller({
      escrowId,
      sellerId: paid.sellerId,
      amount: paid.amount,
      piPaymentId,
    });

    await SettlementLedger.releaseEscrow(escrowId);

    await auditFinalizeDone(paymentIntentId, {
      source: "ledger",
      orderId: paid.orderId,
      escrowId,
      piPaymentId,
      txid,
    });

    return true;
  } catch (e) {
    await auditManualReview(paymentIntentId, "LEDGER_FAILED", {
      txid,
      piPaymentId,
      error: String(e),
    });

    return false;
  }
}

/* =========================================================
   MAIN ORCHESTRATOR (V7)
========================================================= */

export async function runPaymentSettlement({
  paymentIntentId,
  piPaymentId,
  txid,
  userId,
  source,
}: RunPaymentSettlementInput): Promise<PaymentSettlementResult> {
  try {
    /* =====================================================
       1. GUARD
    ===================================================== */

    const guard = await guardPaymentForReconcile({
      paymentIntentId,
      userId: userId ?? "",
    });

    if (!guard.ok) {
      if (guard.code === "PAYMENT_ALREADY_PAID") {
        await auditDuplicateSubmit(paymentIntentId, {
          source,
          reason: guard.code,
        });

        return success(
          guard.orderId ?? "",
          guard.amount ?? 0,
          true,
          source
        );
      }

      await auditManualReview(paymentIntentId, guard.code, { source });
      return fail(0, source);
    }

    /* =====================================================
       2. LOCK
    ===================================================== */

    const lock = await acquirePaymentSettlementLock(paymentIntentId);

    if (!lock.ok) {
      await auditDuplicateSubmit(paymentIntentId, {
        source,
        reason: "LOCK_DENIED",
      });

      return fail(guard.amount ?? 0, source);
    }

    /* =====================================================
       3. PI VERIFY
    ===================================================== */

    const pi = await verifyPiPaymentForReconcile({
      paymentIntentId,
      piPaymentId,
      userId: userId ?? "",
      txid,
    });

    if (!pi.ok) {
      await auditManualReview(paymentIntentId, "PI_VERIFY_FAILED", {
        source,
        txid,
      });

      return fail(0, source);
    }

    /* =====================================================
       4. RPC VERIFY
    ===================================================== */

    const rpc = await verifyRpcCore(
      paymentIntentId,
      piPaymentId,
      txid,
      source
    );

    if (!rpc.ok) {
      return fail(pi.verifiedAmount, source);
    }

    /* =====================================================
       5. COMPLETE PI
    ===================================================== */

    const piDone = await completePiCore(
      paymentIntentId,
      piPaymentId,
      txid,
      source
    );

    if (!piDone) {
      return fail(pi.verifiedAmount, source);
    }

    /* =====================================================
       6. FINALIZE ORDER (CALL BUSINESS ENGINE ONLY)
    ===================================================== */

    const paid = await finalizePaidOrderFromIntent({
      paymentIntentId,
      piPaymentId,
      txid,
      verifiedAmount: pi.verifiedAmount,
      receiverWallet: pi.receiverWallet,
      piPayload: pi.piPayload ?? {},
      rpcPayload: rpc,
    });

    if (!paid.orderId) {
      await writePaymentAudit({
        paymentIntentId,
        eventCode: "FINALIZE_FAILED",
        stage: "FINALIZE",
        actorType: "system",
        source,
        txid,
        piPaymentId,
        newSettlementState: "FAILED",
        payload: { reason: "ORDER_NULL" },
      });

      throw new Error("FINALIZE_FAILED");
    }

    /* =====================================================
       7. LEDGER
    ===================================================== */

    await ledgerCore(paid, paymentIntentId, piPaymentId, txid, rpc);

    return success(
      paid.orderId,
      paid.amount,
      rpc.ok,
      source
    );
  } catch (e) {
    await auditManualReview(paymentIntentId, "FATAL", {
      source,
      txid,
      piPaymentId,
      reason: String(e),
    });

    return fail(0, source);
  }
}
