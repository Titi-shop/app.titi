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
   AUTHORIZE SERVICE (NO DIRECT DB QUERY)
========================================================= */

export async function piAuthorizePayment({
  userId,
  authorizationHeader,
  body,
}: Input): Promise<{ success: true }> {
  console.log("[PAYMENT][AUTHORIZE] START", {
    userId,
    body,
  });

  const paymentIntentId =
    body.paymentIntentId ?? body.payment_intent_id;

  const piPaymentId =
    body.piPaymentId ?? body.pi_payment_id;

  if (!paymentIntentId || !piPaymentId) {
    console.error("[PAYMENT][AUTHORIZE] INVALID_INPUT");
    throw new Error("INVALID_INPUT");
  }

  /* =====================================================
     1. PI VERIFY USER
  ===================================================== */

  console.log("[PAYMENT][AUTHORIZE] PI_VERIFY_START");

  const me = await piGetMe(authorizationHeader);

  console.log("[PAYMENT][AUTHORIZE] PI_OK", {
    uid: me.uid,
  });

  /* =====================================================
     2. FETCH PI PAYMENT
  ===================================================== */

  const payment = await piGetPayment(piPaymentId);

  console.log("[PAYMENT][AUTHORIZE] PI_PAYMENT_OK", {
    id: piPaymentId,
    amount: payment.amount,
    user_uid: payment.user_uid,
  });

  if (payment.user_uid !== me.uid) {
    throw new Error("PI_USER_MISMATCH");
  }

  /* =====================================================
     3. BIND TO DB (ONLY PLACE TOUCH DB)
  ===================================================== */

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

  /* =====================================================
     4. PI APPROVE (AFTER BIND ONLY)
  ===================================================== */

  if (!payment.status?.developer_approved) {
    console.log("[PAYMENT][AUTHORIZE] PI_APPROVE_START");

    await piApprovePayment(piPaymentId);

    console.log("[PAYMENT][AUTHORIZE] PI_APPROVE_DONE");
  }

  /* =====================================================
     5. FINAL
  ===================================================== */

  console.log("[PAYMENT][AUTHORIZE] SUCCESS", {
    paymentIntentId,
    piPaymentId,
  });

  return { success: true };
}
