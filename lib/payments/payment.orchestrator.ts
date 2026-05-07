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
  console.log("[PAYMENT][RPC_VERIFY] START", {
    paymentIntentId,
    txid,
    source,
  });

  try {
    const rpc = await verifyRpcPaymentForReconcile({
      paymentIntentId,
      txid,
    });

    console.log("[PAYMENT][RPC_VERIFY] RESULT", {
      paymentIntentId,
      ok: rpc.ok,
      reason: rpc.reason,
      amount: rpc.amount,
      confirmed: rpc.confirmed,
      ledger: rpc.ledger,
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

      console.log("[PAYMENT][RPC_VERIFY] AUDIT_OK", {
        paymentIntentId,
      });
    } else {
      await auditRpcFailed(paymentIntentId, {
        source,
        txid,
        reason: rpc.reason,
      });

      console.log("[PAYMENT][RPC_VERIFY] AUDIT_FAIL", {
        paymentIntentId,
        reason: rpc.reason,
      });
    }

    return rpc;
  } catch (e) {
    console.error("[PAYMENT][RPC_VERIFY] EXCEPTION", {
      paymentIntentId,
      error: e,
    });

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
  console.log("[PAYMENT][PI_COMPLETE] START", {
    paymentIntentId,
    piPaymentId,
    txid,
  });

  try {
    await piCompletePayment(piPaymentId, txid);

    console.log("[PAYMENT][PI_COMPLETE] SUCCESS", {
      paymentIntentId,
    });

    await auditPiCompleted(paymentIntentId, {
      source,
      piPaymentId,
      txid,
    });

    console.log("[PAYMENT][PI_COMPLETE] AUDIT_OK", {
      paymentIntentId,
    });

    return true;
  } catch (e) {
    console.error("[PAYMENT][PI_COMPLETE] FAIL", {
      paymentIntentId,
      error: e,
    });

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
    if (!paid.orderId) {
      console.warn("[PAYMENT][LEDGER] SKIPPED_NO_ORDER", {
        paymentIntentId,
      });

      return;
    }

    console.log("[PAYMENT][LEDGER] CREATE_ESCROW", {
      paymentIntentId,
      orderId: paid.orderId,
      amount: paid.amount,
    });

    const escrowId = await SettlementLedger.createEscrow({
      paymentIntentId,
      orderId: paid.orderId,
      buyerId: paid.buyerId,
      sellerId: paid.sellerId,
      amount: paid.amount,
      txid,
      piPaymentId,
    });

    console.log("[PAYMENT][LEDGER] ESCROW_CREATED", {
      escrowId,
    });

    await SettlementLedger.markPiVerified(escrowId);

    console.log("[PAYMENT][LEDGER] PI_VERIFIED", {
      escrowId,
    });

    if (rpcVerified.ok) {
      await SettlementLedger.markRpcVerified(escrowId);

      console.log("[PAYMENT][LEDGER] RPC_VERIFIED", {
        escrowId,
      });
    }

    await SettlementLedger.linkOrder(escrowId, paid.orderId);

    console.log("[PAYMENT][LEDGER] ORDER_LINKED", {
      escrowId,
      orderId: paid.orderId,
    });

    await SettlementLedger.creditSeller({
      escrowId,
      sellerId: paid.sellerId,
      amount: paid.amount,
      piPaymentId,
    });

    console.log("[PAYMENT][LEDGER] SELLER_CREDITED", {
      escrowId,
      sellerId: paid.sellerId,
    });

    await SettlementLedger.releaseEscrow(escrowId);

    console.log("[PAYMENT][LEDGER] ESCROW_RELEASED", {
      escrowId,
    });

    await auditFinalizeDone(paymentIntentId, {
      source: "ledger",
      orderId: paid.orderId,
      escrowId,
      piPaymentId,
      txid,
    });

    console.log("[PAYMENT][LEDGER] FINALIZE_AUDITED", {
      paymentIntentId,
      orderId: paid.orderId,
    });
  } catch (e) {
    console.error("[PAYMENT][LEDGER] FAIL", {
      paymentIntentId,
      error: e,
    });

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
  console.log("[PAYMENT][SETTLEMENT] START", {
    paymentIntentId,
    piPaymentId,
    txid,
    userId,
    source,
  });

  /* =====================================================
     1. GUARD
  ===================================================== */

  console.log("[PAYMENT][SETTLEMENT] GUARD_START", {
    paymentIntentId,
  });

  const guard = await guardPaymentForReconcile({
    paymentIntentId,
    userId: userId ?? "",
  });

  console.log("[PAYMENT][SETTLEMENT] GUARD_RESULT", {
    paymentIntentId,
    ok: guard.ok,
    code: guard.code,
    orderId: guard.orderId,
    amount: guard.amount,
  });

  if (!guard.ok) {
    if (guard.code === "PAYMENT_ALREADY_PAID") {
      console.log("[PAYMENT][SETTLEMENT] ALREADY_PAID", {
        paymentIntentId,
        orderId: guard.orderId,
      });

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

    console.error("[PAYMENT][SETTLEMENT] GUARD_FAILED", {
      paymentIntentId,
      code: guard.code,
    });

    await auditManualReview(paymentIntentId, guard.code, {
      source,
    });

    return failResult(0, false, source);
  }

  /* =====================================================
     2. LOCK
  ===================================================== */

  console.log("[PAYMENT][SETTLEMENT] LOCK_START", {
    paymentIntentId,
  });

  const lock = await acquirePaymentSettlementLock(paymentIntentId);

  console.log("[PAYMENT][SETTLEMENT] LOCK_RESULT", {
    paymentIntentId,
    ok: lock.ok,
  });

  if (!lock.ok) {
    console.warn("[PAYMENT][SETTLEMENT] LOCK_DENIED", {
      paymentIntentId,
    });

    await auditDuplicateSubmit(paymentIntentId, {
      source,
      reason: "LOCK_DENIED",
    });

    return failResult(guard.amount ?? 0, false, source);
  }

  /* =====================================================
     3. VERIFY PI
  ===================================================== */

  console.log("[PAYMENT][SETTLEMENT] PI_VERIFY_START", {
    paymentIntentId,
    piPaymentId,
  });

  const piVerified = await verifyPiPaymentForReconcile({
    paymentIntentId,
    piPaymentId,
    userId: userId ?? "",
    txid,
  });

  console.log("[PAYMENT][SETTLEMENT] PI_VERIFY_RESULT", {
    paymentIntentId,
    ok: piVerified.ok,
    amount: piVerified.verifiedAmount,
    receiverWallet: piVerified.receiverWallet,
  });

  if (!piVerified.ok) {
    console.error("[PAYMENT][SETTLEMENT] PI_VERIFY_FAILED", {
      paymentIntentId,
    });

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

  console.log("[PAYMENT][SETTLEMENT] PI_AUDIT_OK", {
    paymentIntentId,
  });

  /* =====================================================
     4. VERIFY RPC
  ===================================================== */

  const rpcVerified = await safeAuditRpc(
    paymentIntentId,
    txid,
    source
  );

  /* =====================================================
     5. COMPLETE PI
  ===================================================== */

  const piCompleted = await safeCompletePi(
    paymentIntentId,
    piPaymentId,
    txid,
    source
  );

  console.log("[PAYMENT][SETTLEMENT] PI_COMPLETE_RESULT", {
    paymentIntentId,
    piCompleted,
  });

  if (!piCompleted) {
    console.error("[PAYMENT][SETTLEMENT] STOP_AFTER_PI_COMPLETE_FAIL", {
      paymentIntentId,
    });

    return failResult(
      piVerified.verifiedAmount,
      rpcVerified.ok,
      source
    );
  }

  /* =====================================================
     6. FINALIZE ORDER
  ===================================================== */

  console.log("[PAYMENT][SETTLEMENT] FINALIZE_ORDER_START", {
    paymentIntentId,
  });

  const paid = await finalizePaidOrderFromIntent({
    paymentIntentId,
    piPaymentId,
    txid,
    verifiedAmount: piVerified.verifiedAmount,
    receiverWallet: piVerified.receiverWallet,
    piPayload: piVerified.piPayload,
    rpcPayload: rpcVerified,
  });

  console.log("[PAYMENT][SETTLEMENT] FINALIZE_ORDER_RESULT", {
    paymentIntentId,
    orderId: paid.orderId,
    amount: paid.amount,
    buyerId: paid.buyerId,
    sellerId: paid.sellerId,
  });

  /* =====================================================
     7. LEDGER
  ===================================================== */

  console.log("[PAYMENT][SETTLEMENT] LEDGER_START", {
    paymentIntentId,
  });

  await safeLedger(
    paid,
    paymentIntentId,
    piPaymentId,
    txid,
    rpcVerified
  );

  console.log("[PAYMENT][SETTLEMENT] SUCCESS", {
    paymentIntentId,
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
    console.error("[PAYMENT][SETTLEMENT] INVALID_REQUEST_BODY", {
      raw,
    });

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
  console.log("[PAYMENT][SETTLEMENT] REQUEST_START", {
    source: input.source,
    userId: input.userId,
  });

  if (!input.rawBody || typeof input.rawBody !== "object") {
    console.error("[PAYMENT][SETTLEMENT] INVALID_RAW_BODY");

    return null;
  }

  const parsed = parseReconcileRequestBody(
    input.rawBody as ReconcileRequestBody
  );

  if (!parsed) {
    console.error("[PAYMENT][SETTLEMENT] PARSE_FAILED");

    return null;
  }

  console.log("[PAYMENT][SETTLEMENT] REQUEST_PARSED", {
    paymentIntentId: parsed.paymentIntentId,
    piPaymentId: parsed.piPaymentId,
    txid: parsed.txid,
  });

  return runPaymentSettlement({
    paymentIntentId: parsed.paymentIntentId,
    piPaymentId: parsed.piPaymentId,
    txid: parsed.txid,
    userId: input.userId,
    source: input.source ?? "reconcile-api",
  });
}
