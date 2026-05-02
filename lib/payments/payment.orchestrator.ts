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
} from "@/lib/db/payments.audit";

import { verifyPiPaymentForReconcile } from "@/lib/db/payments.verify";
import { verifyRpcPaymentForReconcile } from "@/lib/db/payments.rpc";
import { finalizePaidOrderFromIntent } from "@/lib/db/orders.payment";
import { SettlementLedger } from "@/lib/db/settlement.ledger";

import type {
  RunPaymentSettlementInput,
  PaymentSettlementResult,
  RpcAuditResult,
} from "@/lib/payments/payment.types";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* =========================================================
   PI COMPLETE
========================================================= */

async function callPiComplete(
  piPaymentId: string,
  txid: string
): Promise<boolean> {
  try {
    const res = await fetch(`${PI_API}/payments/${piPaymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
      cache: "no-store",
    });

    const txt = await res.text();

    if (!res.ok) {
      if (txt.includes("already_completed")) {
        console.log("[ORCHESTRATOR] PI_ALREADY_COMPLETED");
        return true;
      }

      console.warn("[ORCHESTRATOR] PI_COMPLETE_FAIL", {
        status: res.status,
        body: txt,
      });

      return false;
    }

    console.log("[ORCHESTRATOR] PI_COMPLETE_OK");
    return true;
  } catch (err) {
    console.error("[ORCHESTRATOR] PI_COMPLETE_CRASH", err);
    return false;
  }
}

/* =========================================================
   MAIN HARD SETTLEMENT ENGINE
========================================================= */

export async function runPaymentSettlement({
  paymentIntentId,
  piPaymentId,
  txid,
  userId,
  source,
}: RunPaymentSettlementInput): Promise<PaymentSettlementResult> {
  console.log("[ORCHESTRATOR] START", {
    paymentIntentId,
    piPaymentId,
    txid,
    source,
  });

  /* =====================================================
     STEP A — GUARD STATE
  ===================================================== */

  const guard = await guardPaymentForReconcile({
    paymentIntentId,
    userId: userId ?? "",
  });

  if (!guard.ok) {
    console.warn("[ORCHESTRATOR] GUARD_FAIL", guard.code);

    if (guard.code === "PAYMENT_ALREADY_PAID") {
      await auditDuplicateSubmit(paymentIntentId, {
        source,
        reason: guard.code,
      });

      return {
        ok: true,
        orderId: null,
        amount: 0,
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
     STEP B — LOCK
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
      amount: 0,
      piCompleted: false,
      rpcAudited: false,
      source,
    };
  }

  /* =====================================================
     STEP C — PI VERIFY
  ===================================================== */

  const piVerified = await verifyPiPaymentForReconcile({
    paymentIntentId,
    piPaymentId,
    userId: userId ?? guard.piPaymentId ?? "",
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
     STEP D — RPC VERIFY (HARD BLOCK)
  ===================================================== */

  let rpcVerified: RpcAuditResult;

  try {
    rpcVerified = await verifyRpcPaymentForReconcile({
      paymentIntentId,
      txid,
    });
  } catch (err) {
    await auditRpcFailed(paymentIntentId, {
      source,
      reason: err instanceof Error ? err.message : String(err),
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

  if (!rpcVerified.ok) {
    await auditRpcFailed(paymentIntentId, {
      source,
      reason: rpcVerified.reason,
      amount: rpcVerified.amount,
      receiver: rpcVerified.receiver,
      ledger: rpcVerified.ledger,
    });

    await auditManualReview(paymentIntentId, "RPC_BLOCKED", {
      source,
      txid,
      reason: rpcVerified.reason,
    });

    return {
      ok: false,
      orderId: null,
      amount: piVerified.verifiedAmount,
      piCompleted: false,
      rpcAudited: true,
      source,
    };
  }

  await auditRpcVerified(paymentIntentId, {
    source,
    txid,
    amount: rpcVerified.amount,
    sender: rpcVerified.sender,
    receiver: rpcVerified.receiver,
    ledger: rpcVerified.ledger,
  });

  /* =====================================================
     STEP E — PI COMPLETE HARD GATE
  ===================================================== */

  const piCompleted = await callPiComplete(piPaymentId, txid);

  if (!piCompleted) {
    await auditManualReview(paymentIntentId, "PI_COMPLETE_FAILED", {
      source,
      txid,
    });

    return {
      ok: false,
      orderId: null,
      amount: piVerified.verifiedAmount,
      piCompleted: false,
      rpcAudited: true,
      source,
    };
  }

  await auditPiCompleted(paymentIntentId, {
    source,
    piPaymentId,
    txid,
  });

  /* =====================================================
     STEP F — FINALIZE ORDER (NOW SAFE)
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
     STEP G — LEDGER WRITE
  ===================================================== */

  try {
    if (paid.orderId) {
      const escrow = await SettlementLedger.createEscrow({
        paymentIntentId,
        orderId: paid.orderId,
        buyerId: userId ?? "SYSTEM",
        sellerId: "SYSTEM_SELLER_RESOLVE",
        amount: piVerified.verifiedAmount,
        currency: "PI",
      });

      await SettlementLedger.markPaymentConfirmed({
        escrowId: escrow.id,
        txid,
        source: "PI",
      });

      await SettlementLedger.markPaymentConfirmed({
        escrowId: escrow.id,
        txid,
        source: "RPC",
      });

      await SettlementLedger.linkOrder({
        escrowId: escrow.id,
        orderId: paid.orderId,
      });
    }
  } catch (err) {
    console.error("[ORCHESTRATOR] LEDGER_FAIL", err);
  }

  console.log("[ORCHESTRATOR] SUCCESS", {
    orderId: paid.orderId,
  });

  return {
    ok: true,
    orderId: paid.orderId,
    amount: piVerified.verifiedAmount,
    piCompleted: true,
    rpcAudited: true,
    source,
  };
}
