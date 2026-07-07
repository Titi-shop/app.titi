
import {
  guardPaymentV7,
  acquirePaymentLockV7,
} from "@/lib/db/payments.guard";

import { verifyRpcPaymentForReconcile } from "@/lib/db/payments.rpc";
import { piCompletePayment } from "@/lib/pi/client";
import {
  finalizePaidOrderFromIntent,
} from "@/lib/db/orders.payment";

import type {
  RunPaymentSettlementInput,
  PaymentSettlementResult,
} from "@/lib/payments/types";
import {
  logger,
  maskId,
  maskWallet,
} from "@/lib/logger";
/* =========================================================
   RESULT BUILDERS
========================================================= */

function failResult(
  amount: number,
  rpcAudited: boolean
): PaymentSettlementResult {
  return {
    ok: false,
    orderId: null,
    amount,
    piCompleted: false,
    rpcAudited,
  
  };
}

function successResult(
  orderId: string | null,
  amount: number,
  rpcAudited: boolean
): PaymentSettlementResult {
  return {
    ok: true,
    orderId,
    amount,
    piCompleted: true,
    rpcAudited,
    
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
  logger.info(
  "PAYMENT.PI_COMPLETE.START",
  {
    paymentIntentId: maskId(paymentIntentId),
    piPaymentId: maskId(piPaymentId),
    txid: maskId(txid),
  }
);

  try {
    await piCompletePayment(piPaymentId, txid);

    logger.info(
  "PAYMENT.PI_COMPLETE.SUCCESS",
  {
    paymentIntentId: maskId(paymentIntentId),
  }
);

    logger.info(
  "PAYMENT.PI_COMPLETE.AUDIT_OK",
  {
    paymentIntentId: maskId(paymentIntentId),
  }
);

    return true;
  } catch (e) {
    logger.error(
  "PAYMENT.PI_COMPLETE.FAIL",
  {
    paymentIntentId: maskId(paymentIntentId),
    message:
      e instanceof Error
        ? e.message
        : "UNKNOWN_ERROR",
  }
);

if (
  process.env.NODE_ENV !==
  "production"
) {
  console.error(e);
}

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
  logger.info(
  "PAYMENT.SETTLEMENT.START",
  {
    paymentIntentId: maskId(paymentIntentId),
    piPaymentId: maskId(piPaymentId),
    txid: maskId(txid),
    userId: maskId(userId),
  }
);

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

    return failResult(0, false);
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

    return failResult(guard.amount ?? 0, false);
  }

  /* =====================================================
     4. VERIFY RPC
  ===================================================== */
const rpcVerified =
  await verifyRpcPaymentForReconcile({
    paymentIntentId,
    piPaymentId,
    txid,
  });
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

const finalized =
  await finalizePaidOrderFromIntent({
    paymentIntentId,
    piPaymentId,
    txid,
    verifiedAmount:
      rpcVerified.amount ?? 0,
    receiverWallet:
      rpcVerified.receiver ?? "",
    piPayload:
      rpcVerified.payload,
  });

return successResult(
  finalized.orderId,
  finalized.amount,
  rpcVerified.ok
);
  } catch (e) {

  console.error("[PAYMENT][SETTLEMENT][FATAL]", {
    paymentIntentId,
    error: e,
  });

  return failResult(0, false);
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
}): Promise<PaymentSettlementResult | null> {
  console.log("[PAYMENT][SETTLEMENT] REQUEST_START", {
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
  });
}
