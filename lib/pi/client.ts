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
  auditRpcVerified,
} from "@/lib/db/payments.audit";

import { verifyPiPaymentForReconcile } from "@/lib/db/payments.verify";
import { verifyRpcPaymentForReconcile } from "@/lib/db/payments.rpc";
import { finalizePaidOrderFromIntent } from "@/lib/db/orders.payment";
import { SettlementLedgerV3 as SettlementLedger } from "@/lib/db/settlement.ledger";
import { piCompletePayment } from "@/lib/pi/client";

import type {
  RunPaymentSettlementInput,
  PaymentSettlementResult,
  RpcAuditResult,
} from "@/lib/payments/payment.types";

/* =========================================================
   EMPTY RPC FALLBACK
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
   MAIN PAYMENT SETTLEMENT ORCHESTRATOR
========================================================= */

export async function runPaymentSettlement({
  paymentIntentId,
  piPaymentId,
  txid,
  userId,
  source,
}: RunPaymentSettlementInput): Promise<PaymentSettlementResult> {
  console.log("[PAYMENT][SETTLEMENT_START]", {
    paymentIntentId,
    piPaymentId,
    txid,
    source,
  });

  /* =====================================================
     STEP 1 — PRE GUARD
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

      return {
        ok: true,
        orderId: guard.orderId ?? null,
        amount: guard.amount ?? 0,
        piCompleted: true,
        rpcAudited: true,
        source,
      };
    }

    await auditManualReview(paymentIntentId, guard.code, { source });

    return {
      ok: false,
      orderId: null,
      amount: 0,
      piCompleted: false,
      rpcAudited: false,
      source,
    };
  }

  /* =====================================================
     STEP 2 — PI VERIFY (PRIMARY SOURCE OF TRUTH)
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
    });

    return {
      ok: false,
      orderId: null,
      amount: 0,
      piCompleted: false,
      rpcAudited: false,
      source,
    };
  }

  await auditPiVerified(paymentIntentId, {
    source,
    txid,
    amount: piVerified.verifiedAmount,
    receiverWallet: piVerified.receiverWallet,
  });

  /* =====================================================
     STEP 3 — DISTRIBUTED LOCK
  ===================================================== */

  const lock = await acquirePaymentSettlementLock(paymentIntentId);

  if (!lock.ok) {
    await auditDuplicateSubmit(paymentIntentId, {
      source,
      reason: "LOCK_DENIED",
    });

    return {
      ok: false,
      orderId: null,
      amount: piVerified.verifiedAmount,
      piCompleted: false,
      rpcAudited: false,
      source,
    };
  }

  /* =====================================================
     STEP 4 — RPC VERIFY (NON BLOCKING)
  ===================================================== */

  let rpcVerified: RpcAuditResult = emptyRpc();

  try {
    rpcVerified = await verifyRpcPaymentForReconcile({
      paymentIntentId,
      txid,
    });

    if (rpcVerified.ok) {
      await auditRpcVerified(paymentIntentId, {
        source,
        txid,
        amount: rpcVerified.amount,
      });
    }
  } catch (e) {
    console.warn("[PAYMENT][RPC_VERIFY_FAIL]", e);
  }

  /* =====================================================
     STEP 5 — PI COMPLETE (IDEMPOTENT VENDOR SIDE EFFECT)
  ===================================================== */

  try {
    await piCompletePayment(piPaymentId, txid);
  } catch {
    await auditManualReview(paymentIntentId, "PI_COMPLETE_FAILED", {
      source,
      txid,
    });

    return {
      ok: false,
      orderId: null,
      amount: piVerified.verifiedAmount,
      piCompleted: false,
      rpcAudited: rpcVerified.ok,
      source,
    };
  }

  await auditPiCompleted(paymentIntentId, {
    source,
    piPaymentId,
    txid,
  });

  /* =====================================================
     STEP 6 — FINALIZE ORDER + STOCK + PAYMENT WRITE
  ===================================================== */

  const paid = await finalizePaidOrderFromIntent({
    paymentIntentId,
    piPaymentId,
    txid,
    verifiedAmount: piVerified.verifiedAmount,
    receiverWallet: piVerified.receiverWallet,
    piPayload: piVerified.piPayload,
    rpcPayload: rpcVerified,
  });

  await auditFinalizeDone(paymentIntentId, {
    source,
    orderId: paid.orderId,
  });

  /* =====================================================
     STEP 7 — SETTLEMENT LEDGER (NON BLOCKING)
  ===================================================== */

  try {
    if (paid.orderId) {
      const escrowId = await SettlementLedger.createEscrow({
        paymentIntentId,
        orderId: paid.orderId,
        buyerId: paid.buyerId,
        sellerId: paid.sellerId,
        amount: piVerified.verifiedAmount,
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
        amount: piVerified.verifiedAmount,
      });

      await SettlementLedger.releaseEscrow(escrowId);
    }
  } catch (e) {
    console.error("[PAYMENT][LEDGER_FAIL]", e);
  }

  console.log("[PAYMENT][SETTLEMENT_SUCCESS]", {
    orderId: paid.orderId,
    amount: piVerified.verifiedAmount,
  });

  return {
    ok: true,
    orderId: paid.orderId,
    amount: piVerified.verifiedAmount,
    piCompleted: true,
    rpcAudited: rpcVerified.ok,
    source,
  };
}
