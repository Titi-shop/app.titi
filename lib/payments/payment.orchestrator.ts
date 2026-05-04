import {
  guardPaymentForReconcile,
  acquirePaymentSettlementLock,
} from "@/lib/db/payments.guard";

import {
  auditDuplicateSubmit,
  auditManualReview,
  auditRpcFailed,
} from "@/lib/db/payments.audit";

import { verifyPiPaymentForReconcile } from "@/lib/db/payments.verify";
import { verifyRpcPaymentForReconcile } from "@/lib/db/payments.rpc";
import { finalizePaidOrderFromIntent } from "@/lib/db/orders.payment";

import type {
  RunPaymentSettlementInput,
  PaymentSettlementResult,
  RpcAuditResult,
} from "@/lib/payments/payment.types";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* =========================================================
   SAFE PI COMPLETE
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
      cache: "no-store",
      body: JSON.stringify({ txid }),
    });

    const text = await res.text();

    if (!res.ok) {
      if (text.includes("already_completed")) {
        console.log("[PI COMPLETE] already_completed");
        return true;
      }

      console.warn("[PI COMPLETE FAIL]", {
        status: res.status,
        body: text,
      });

      return false;
    }

    console.log("[PI COMPLETE OK]");
    return true;
  } catch (e) {
    console.error("[PI COMPLETE CRASH]", e);
    return false;
  }
}

/* =========================================================
   EMPTY RPC
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
   MAIN ORCHESTRATOR V5
========================================================= */

export async function runPaymentSettlement({
  paymentIntentId,
  piPaymentId,
  txid,
  userId,
  source,
}: RunPaymentSettlementInput): Promise<PaymentSettlementResult> {
  console.log("[ORCHESTRATOR V5 START]", {
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
     STEP 2 — GLOBAL SETTLEMENT LOCK
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
     STEP 3 — PI VERIFY (HARD MONEY VERIFY)
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

  /* =====================================================
     STEP 4 — RPC VERIFY (SOFT FORENSIC)
  ===================================================== */

  let rpcVerified: RpcAuditResult = emptyRpc();

  try {
    rpcVerified = await verifyRpcPaymentForReconcile({
      paymentIntentId,
      txid,
    });
  } catch (e) {
    console.warn("[RPC VERIFY CRASH]", e);
    rpcVerified = emptyRpc();
  }

  if (!rpcVerified.ok) {
    await auditRpcFailed(paymentIntentId, {
      source,
      stage: rpcVerified.stage,
      reason: rpcVerified.reason,
    });
  }

  /* =====================================================
     STEP 5 — PI COMPLETE HARD GATE
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
      rpcAudited: rpcVerified.audited,
      source,
    };
  }

  /* =====================================================
     STEP 6 — SINGLE DOMAIN FINALIZER
  ===================================================== */

  const paid = await finalizePaidOrderFromIntent({
    paymentIntentId,
    piPaymentId,
    txid,
    verifiedAmount: piVerified.verifiedAmount,
    receiverWallet: piVerified.receiverWallet,
    piUid: piVerified.piUid ?? null,
    piPayload: piVerified.piPayload,
    rpcPayload: rpcVerified,
  });

  console.log("[ORCHESTRATOR V5 SUCCESS]", {
    orderId: paid.orderId,
  });

  return {
    ok: true,
    orderId: paid.orderId,
    amount: piVerified.verifiedAmount,
    piCompleted: true,
    rpcAudited: rpcVerified.audited,
    source,
  };
}
