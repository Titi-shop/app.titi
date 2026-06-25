
import {
  guardPaymentV7,
  acquirePaymentLockV7,
} from "@/lib/db/payments.guard";
import { verifyRpcPaymentForReconcile } from "@/lib/db/payments.rpc";
import { piCompletePayment } from "@/lib/pi/client";

import type {
  RunPaymentSettlementInput,
  PaymentSettlementResult,
  RpcAuditResult,
} from "@/lib/payments/types";
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
    txStatus: "UNKNOWN",
    chainReference: null,
    stage: "UNSET",
    reason: "NOT_EXECUTED",
    payload: {},
    createdAt: null,
    memo: null,
    verified: false,
verifyStatus: "manual_review",
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
   SAFE PI COMPLETE
========================================================= */

async function safeCompletePi(
  paymentIntentId: string,
  piPaymentId: string,
  txid: string
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

    console.log("[PAYMENT][PI_COMPLETE] AUDIT_OK", {
      paymentIntentId,
    });

    return true;
  } catch (e) {
    console.error("[PAYMENT][PI_COMPLETE] FAIL", {
      paymentIntentId,
      error: e,
    });

    return false;
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
}: RunPaymentSettlementInput): Promise<PaymentSettlementResult> {
  try {
  console.log("[PAYMENT][SETTLEMENT] START", {
    paymentIntentId,
    piPaymentId,
    txid,
    userId,
  });

  /* =====================================================
     1. GUARD
  ===================================================== */

  console.log("[PAYMENT][SETTLEMENT] GUARD_START", {
    paymentIntentId,
  });

  const guard = await guardPaymentV7(paymentIntentId, userId);

  console.log("[PAYMENT][SETTLEMENT] GUARD_RESULT", {
    paymentIntentId,
    ok: guard.ok,
    code: guard.code,
    orderId: guard.orderId,
    amount: guard.amount,
  });

  if (!guard.ok || guard.amount === 0) {
    if (guard.code === "PAYMENT_ALREADY_PAID") {
      console.log("[PAYMENT][SETTLEMENT] ALREADY_PAID", {
        paymentIntentId,
        orderId: guard.orderId,
      });
      return successResult(
        guard.orderId ?? null,
        guard.amount ?? 0,
        true
      );
    }

    console.error("[PAYMENT][SETTLEMENT] GUARD_FAILED", {
      paymentIntentId,
      code: guard.code,
    });

    return failResult(0, false, source);
  }

  /* =====================================================
     2. LOCK
  ===================================================== */

  console.log("[PAYMENT][SETTLEMENT] LOCK_START", {
    paymentIntentId,
  });

  const lock = await acquirePaymentLockV7(paymentIntentId);
  console.log("[PAYMENT][SETTLEMENT] LOCK_RESULT", {
    paymentIntentId,
    ok: lock.ok,
  });

  if (!lock.ok) {
    console.warn("[PAYMENT][SETTLEMENT] LOCK_DENIED", {
      paymentIntentId,
    });

    return failResult(guard.amount ?? 0, false, source);
  }

  /* =====================================================
     4. VERIFY RPC
  ===================================================== */

    if (!rpcVerified.ok) {
  console.error(
    "[PAYMENT][SETTLEMENT] RPC_VERIFY_FAILED",
    {
      paymentIntentId,
      reason: rpcVerified.reason,
    }
  );


  console.warn(
    "[PAYMENT][SETTLEMENT] RPC_SOFT_FAIL"
  );
}

  /* =====================================================
     5. COMPLETE PI
  ===================================================== */

  const piCompleted = await safeCompletePi(
    paymentIntentId,
    piPaymentId,
    txid
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
  rpcVerified.amount ?? 0,
  rpcVerified.ok
);
  }
  return successResult(
  null,
  rpcVerified.amount ?? 0,
  rpcVerified.ok
);

  } catch (e) {

  console.error("[PAYMENT][SETTLEMENT][FATAL]", {
    paymentIntentId,
    error: e,
  });

  return failResult(0, false, source);
}
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
