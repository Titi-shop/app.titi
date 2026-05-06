
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
   RESULT BUILDERS
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
   SAFE RPC VERIFY
========================================================= */

async function safeAuditRpc(
  paymentIntentId: string,
  txid: string,
  source: string
): Promise<RpcAuditResult> {
  try {
    const rpc = await verifyRpcPaymentForReconcile({
      paymentIntentId,
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
    console.warn("[PAYMENT][RPC_VERIFY_FAIL]", e);

    await auditRpcFailed(paymentIntentId, {
      source,
      txid,
      reason: "RPC_EXCEPTION",
    });

    return emptyRpc();
  }
}

/* =========================================================
   SAFE PI COMPLETE
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
  } catch (e) {
    console.error("[PAYMENT][PI_COMPLETE_FAIL]", e);

    await auditManualReview(paymentIntentId, "PI_COMPLETE_FAILED", {
      source,
      txid,
      piPaymentId,
    });

    return false;
  }
}

/* =========================================================
   SAFE LEDGER PIPELINE
========================================================= */

async function safeLedger(
  paid: FinalizePaidOrderResult,
  paymentIntentId: string,
  piPaymentId: string,
  txid: string,
  rpcVerified: RpcAuditResult
): Promise<void> {
  try {
    if (!paid.orderId) return;

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
  } catch (e) {
    console.error("[PAYMENT][LEDGER_FAIL]", e);

    await auditManualReview(paymentIntentId, "LEDGER_PIPELINE_FAILED", {
      txid,
      piPaymentId,
    });
  }
}

/* =========================================================
   MAIN PAYMENT SETTLEMENT CORE
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
    amount: piVerified.verifiedAmount,
    receiverWallet: piVerified.receiverWallet,
  });

  /* =====================================================
     4. VERIFY RPC (NON BLOCKING BUT AUDITED)
  ===================================================== */

  const rpcVerified = await safeAuditRpc(paymentIntentId, txid, source);

  /* =====================================================
     5. COMPLETE PI
  ===================================================== */

  const piCompleted = await safeCompletePi(
    paymentIntentId,
    piPaymentId,
    txid,
    source
  );

  if (!piCompleted) {
    return failResult(piVerified.verifiedAmount, rpcVerified.ok, source);
  }

  /* =====================================================
     6. FINALIZE ORDER CORE
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

  /* =====================================================
     7. LEDGER PIPELINE
  ===================================================== */

  await safeLedger(
    paid,
    paymentIntentId,
    piPaymentId,
    txid,
    rpcVerified
  );

  console.log("[PAYMENT][SETTLEMENT_SUCCESS]", {
    orderId: paid.orderId,
    amount: paid.amount,
    rpcAudited: rpcVerified.ok,
  });

  return successResult(
    paid.orderId,
    paid.amount,
    rpcVerified.ok,
    source
  );
}

/* =========================================================
   REQUEST BODY PARSER
========================================================= */

type ReconcileRequestBody = {
  payment_intent_id?: unknown;
  pi_payment_id?: unknown;
  txid?: unknown;
};

function parseReconcileRequestBody(raw: ReconcileRequestBody): {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
} | null {
  const paymentIntentId =
    typeof raw.payment_intent_id === "string"
      ? raw.payment_intent_id.trim()
      : "";

  const piPaymentId =
    typeof raw.pi_payment_id === "string"
      ? raw.pi_payment_id.trim()
      : "";

  const txid =
    typeof raw.txid === "string"
      ? raw.txid.trim()
      : "";

  if (!paymentIntentId || !piPaymentId || !txid) {
    return null;
  }

  return {
    paymentIntentId,
    piPaymentId,
    txid,
  };
}

export async function runPaymentSettlementFromRequest(input: {
  rawBody: unknown;
  userId: string;
  source?: string;
}): Promise<PaymentSettlementResult | null> {
  if (!input.rawBody || typeof input.rawBody !== "object") {
    return null;
  }

  const parsed = parseReconcileRequestBody(
    input.rawBody as ReconcileRequestBody
  );

  if (!parsed) {
    return null;
  }

  return runPaymentSettlement({
    paymentIntentId: parsed.paymentIntentId,
    piPaymentId: parsed.piPaymentId,
    txid: parsed.txid,
    userId: input.userId,
    source: input.source ?? "reconcile-api",
  });
}
