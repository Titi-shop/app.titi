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
import { SettlementLedgerV2 as SettlementLedger } from "@/lib/db/settlement.ledger";

import type {
  RunPaymentSettlementInput,
  PaymentSettlementResult,
  RpcAuditResult,
} from "@/lib/payments/payment.types";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* =========================================================
   PI COMPLETE SAFE IDEMPOTENT
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
   EMPTY RPC RESULT
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
   MAIN ORCHESTRATOR FINAL
========================================================= */

export async function runPaymentSettlement({
  paymentIntentId,
  piPaymentId,
  txid,
  userId,
  source,
}: RunPaymentSettlementInput): Promise<PaymentSettlementResult> {
  console.log("[ORCHESTRATOR START]", {
    paymentIntentId,
    piPaymentId,
    txid,
    source,
  });

  /* =====================================================
     STEP 1 — GUARD PAYMENT STATE
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

      console.log("[ORCHESTRATOR EXIT] ALREADY_PAID");

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

    console.warn("[ORCHESTRATOR EXIT] GUARD_FAIL", guard.code);

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
     STEP 2 — ACQUIRE SINGLE EXECUTION LOCK
  ===================================================== */

  const lock = await acquirePaymentSettlementLock(paymentIntentId);

  if (!lock.ok) {
    await auditDuplicateSubmit(paymentIntentId, {
      source,
      reason: "LOCK_DENIED",
    });

    console.warn("[ORCHESTRATOR EXIT] LOCK_DENIED");

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
     STEP 3 — PI VERIFY (PRIMARY MONEY SOURCE)
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

    console.warn("[ORCHESTRATOR EXIT] PI_VERIFY_FAIL");

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
     STEP 4 — RPC AUDIT (SECONDARY / NON BLOCKING)
  ===================================================== */

  let rpcVerified: RpcAuditResult = emptyRpc();

  try {
    const rpc = await verifyRpcPaymentForReconcile({
      paymentIntentId,
      txid,
    });

    rpcVerified = rpc;
  } catch (e) {
    console.warn("[RPC VERIFY CRASH]", e);
    rpcVerified = emptyRpc();
  }

  if (!rpcVerified.ok) {
    await auditRpcFailed(paymentIntentId, {
      source,
      reason: rpcVerified.reason ?? "RPC_AUDIT_FAIL",
    });

    console.warn("[RPC AUDIT FAIL BUT CONTINUE]", {
      stage: rpcVerified.stage,
      reason: rpcVerified.reason,
    });
  } else {
    await auditRpcVerified(paymentIntentId, {
      source,
      txid,
      amount: rpcVerified.amount,
      sender: rpcVerified.sender,
      receiver: rpcVerified.receiver,
      ledger: rpcVerified.ledger,
    });
  }

  /* =====================================================
     STEP 5 — PI COMPLETE (HARD GATE)
  ===================================================== */

  const piCompleted = await callPiComplete(piPaymentId, txid);

  if (!piCompleted) {
    await auditManualReview(paymentIntentId, "PI_COMPLETE_FAILED", {
      source,
      txid,
    });

    console.warn("[ORCHESTRATOR EXIT] PI_COMPLETE_FAILED");

    return {
      ok: false,
      orderId: null,
      amount: piVerified.verifiedAmount,
      piCompleted: false,
      rpcAudited: rpcVerified.audited,
      source,
    };
  }

  await auditPiCompleted(paymentIntentId, {
    source,
    piPaymentId,
    txid,
  });

  /* =====================================================
     STEP 6 — FINALIZE DB ORDER (IDEMPOTENT)
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
   STEP 7 — INTERNAL LEDGER (NON BLOCKING)
===================================================== */

try {
  if (paid.orderId) {
    const escrowId = await SettlementLedger.createEscrow({
      paymentIntentId,
      orderId: paid.orderId,
      buyerId: userId ?? "SYSTEM",
      sellerId: paid.sellerId ?? "SYSTEM",
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
      sellerId: paid.sellerId ?? "SYSTEM",
      amount: piVerified.verifiedAmount,
    });

    await SettlementLedger.releaseEscrow(escrowId);
  }
} catch (e) {
  console.error("[LEDGER FAIL]", e);
}

console.log("[ORCHESTRATOR SUCCESS]", {
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
