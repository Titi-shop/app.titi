import {
  piGetMe,
  piGetPayment,
  piApprovePayment,
} from "@/lib/pi/client";

import { bindPiPaymentToIntent } from "@/lib/db/payments.bind";

/* =========================================================
   TYPES
========================================================= */

type AuthorizeBody = {
  paymentIntentId?: string;
  payment_intent_id?: string;
  piPaymentId?: string;
  pi_payment_id?: string;
};

type Input = {
  userId: string;
  authorizationHeader: string;
  body: AuthorizeBody;
};

/* =========================================================
   HELPERS
========================================================= */

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.00001;
}

/* =========================================================
   MAIN SERVICE (CLEAN ARCHITECTURE)
========================================================= */

export async function piAuthorizePayment({
  userId,
  authorizationHeader,
  body,
}: Input): Promise<{ success: true }> {
  console.log("[PAYMENT][AUTHORIZE] START", { userId });

  const paymentIntentId =
    body.paymentIntentId ?? body.payment_intent_id;

  const piPaymentId =
    body.piPaymentId ?? body.pi_payment_id;

  if (!paymentIntentId || !piPaymentId) {
    console.error("[PAYMENT][AUTHORIZE] INVALID_INPUT");
    throw new Error("INVALID_INPUT");
  }

  /* =========================================================
     1. VERIFY PI USER (OUTSIDE DB)
  ========================================================= */

  console.log("[PAYMENT][AUTHORIZE] PI_VERIFY_START");

  const me = await piGetMe(authorizationHeader);
  const payment = await piGetPayment(piPaymentId);

  console.log("[PAYMENT][AUTHORIZE] PI_OK", {
    uid: me.uid,
  });

  if (payment.user_uid !== me.uid) {
    console.error("[PAYMENT][AUTHORIZE] PI_USER_MISMATCH");
    throw new Error("PI_USER_MISMATCH");
  }

  /* =========================================================
     2. BASIC VALIDATION (NO DB LOCK HERE)
  ========================================================= */

  if (!payment.amount) {
    console.error("[PAYMENT][AUTHORIZE] INVALID_AMOUNT");
    throw new Error("INVALID_AMOUNT");
  }

  /* =========================================================
     3. BIND TO INTENT (DB LAYER ONLY)
     👉 toàn bộ transaction nằm trong lib/db/payments.bind
  ========================================================= */

  console.log("[PAYMENT][AUTHORIZE] BIND_START");

  await bindPiPaymentToIntent({
    userId,
    paymentIntentId,
    piPaymentId,
    piUid: me.uid,
    verifiedAmount: Number(payment.amount),
    piPayload: payment,
  });

  console.log("[PAYMENT][AUTHORIZE] BIND_DONE");

  /* =========================================================
     4. MARK PI PAYMENT APPROVED (NO DB)
  ========================================================= */

  if (!payment.status?.developer_approved) {
    console.log("[PAYMENT][AUTHORIZE] PI_APPROVE_START");

    await piApprovePayment(piPaymentId);

    console.log("[PAYMENT][AUTHORIZE] PI_APPROVE_DONE");
  }

  /* =========================================================
     5. FINAL SUCCESS
  ========================================================= */

  console.log("[PAYMENT][AUTHORIZE] SUCCESS", {
    paymentIntentId,
    piPaymentId,
  });

  return { success: true };
}
