import {
  guardPaymentForReconcile,
  acquirePaymentSettlementLock,
} from "@/lib/db/payments.guard";

import {
  auditDuplicateSubmit,
  auditFinalizeDone,
  auditManualReview,
  auditPiCompleted,
  auditPiVerified,
  auditRpcFailed,
  auditRpcVerified,
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
  PaymentIntentRow,
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

function failResult(
  amount: number,
  rpcAudited: boolean,
  source: string
): PaymentSettlementResult {
  return {
    ok: false,
    orderId: null,
    amount,
    piCompleted: false,
    rpcAudited,
    source,
  };
}

function successResult(
  orderId: string | null,
  amount: number,
  rpcAudited: boolean,
  source: string
): PaymentSettlementResult {
  return {
    ok: true,
    orderId,
    amount,
    piCompleted: true,
    rpcAudited,
    source,
  };
}

/* =========================================================
   RPC VERIFY
========================================================= */

async function safeAuditRpc(
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
  } catch {
    await auditRpcFailed(paymentIntentId, {
      source,
      txid,
      reason: "RPC_EXCEPTION",
    });

    return emptyRpc();
  }
}

/* =========================================================
   PI COMPLETE
========================================================= */

async function safeCompletePi(
  paymentIntentId: string,
  piPaymentId: string,
  txid: string,
  source: string
): Promise<boolean> {
  try {
    await piCompletePayment(piPaymentId, txid);

    await auditPiCompleted(paymentIntentId, {
      source,
      piPaymentId,
      txid,
    });

    return true;
  } catch {
    await auditManualReview(paymentIntentId, "PI_COMPLETE_FAILED", {
      source,
      piPaymentId,
      txid,
    });

    return false;
  }
}

/* =========================================================
   LEDGER
========================================================= */

async function safeLedger(
  paid: FinalizePaidOrderResult,
  paymentIntentId: string,
  piPaymentId: string,
  txid: string,
  rpcVerified: RpcAuditResult
) {
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

  if (rpcVerified.ok) {
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
}

/* =========================================================
   MAIN ORCHESTRATOR (NO DB CALL HERE)
========================================================= */

export async function runPaymentSettlement({
  paymentIntentId,
  piPaymentId,
  txid,
  userId,
  source,
  intent,
}: RunPaymentSettlementInput & {
  intent: PaymentIntentRow;
}): Promise<PaymentSettlementResult> {
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
          reason: "PAYMENT_ALREADY_PAID",
        });

        return successResult(
          guard.orderId ?? null,
          guard.amount ?? 0,
          true,
          source
        );
      }

      await auditManualReview(paymentIntentId, guard.code, { source });
      return failResult(0, false, source);
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

      return failResult(guard.amount ?? 0, false, source);
    }

    /* =====================================================
       3. VERIFY PI
    ===================================================== */

    const piVerified = await verifyPiPaymentForReconcile({
      paymentIntentId,
      piPaymentId,
      userId: userId ?? "",
      txid,
    });

    if (!piVerified.ok) {
      await auditManualReview(paymentIntentId, "PI_VERIFY_FAIL", {
        source,
        txid,
        piPaymentId,
      });

      return failResult(0, false, source);
    }

    await auditPiVerified(paymentIntentId, {
      source,
      txid,
      piPaymentId,
      actorId: userId,
      amount: piVerified.verifiedAmount,
      receiverWallet: piVerified.receiverWallet,
    });

    /* =====================================================
       4. RPC VERIFY
    ===================================================== */

    const rpcVerified = await safeAuditRpc(
      paymentIntentId,
      piPaymentId,
      txid,
      source
    );

    if (!rpcVerified.ok) {
      return failResult(piVerified.verifiedAmount, false, source);
    }

    /* =====================================================
       5. PI COMPLETE
    ===================================================== */

    const piCompleted = await safeCompletePi(
      paymentIntentId,
      piPaymentId,
      txid,
      source
    );

    if (!piCompleted) {
      return failResult(
        piVerified.verifiedAmount,
        rpcVerified.ok,
        source
      );
    }

    /* =====================================================
       6. FINALIZE ORDER
    ===================================================== */

    await writePaymentAudit({
      paymentIntentId,
      eventCode: "FINALIZE_STARTED",
      stage: "FINALIZE",
      actorType: "system",
      source,
      txid,
      piPaymentId,
    });

    const paid = await finalizePaidOrderFromIntent({
      paymentIntentId,
      piPaymentId,
      txid,
      verifiedAmount: piVerified.verifiedAmount,
      receiverWallet: piVerified.receiverWallet,
      piPayload: piVerified.piPayload ?? {},
      rpcPayload: rpcVerified,
      intent,
    });

    if (!paid.orderId) {
      throw new Error("ORDER_FINALIZE_FAILED");
    }

    /* =====================================================
       7. LEDGER
    ===================================================== */

    await safeLedger(
      paid,
      paymentIntentId,
      piPaymentId,
      txid,
      rpcVerified
    );

    return successResult(
      paid.orderId,
      paid.amount,
      rpcVerified.ok,
      source
    );
  } catch (e) {
    await auditManualReview(paymentIntentId, "SETTLEMENT_FATAL", {
      source,
      txid,
      piPaymentId,
      reason: String(e),
    });

    return failResult(0, false, source);
  }
}
