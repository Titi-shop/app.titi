import { bindPiPaymentToIntent } from "@/lib/db/payments.verify";
import {
  piGetMe,
  piGetPayment,
  piApprovePayment,
} from "@/lib/pi/client";

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
   AUTHORIZE PAYMENT
========================================================= */

export async function piAuthorizePayment({
  userId,
  authorizationHeader,
  body,
}: Input): Promise<{ success: true }> {
  console.log("[PAYMENT][AUTHORIZE] START");

  const paymentIntentId =
    body.paymentIntentId ?? body.payment_intent_id ?? null;

  const piPaymentId =
    body.piPaymentId ?? body.pi_payment_id ?? null;

  if (!paymentIntentId || !piPaymentId) {
    throw new Error("INVALID_INPUT");
  }

  /* ================= PI USER VERIFY ================= */

  const me = await piGetMe(authorizationHeader);

  /* ================= PI PAYMENT FETCH ================= */

  const payment = await piGetPayment(piPaymentId);

  if (payment.user_uid !== me.uid) {
    throw new Error("PI_USER_MISMATCH");
  }

  /* ================= DB BIND ================= */

  await bindPiPaymentToIntent({
    userId,
    paymentIntentId,
    piPaymentId,
    piUid: me.uid,
    verifiedAmount: Number(payment.amount),
    piPayload: payment,
  });

  /* ================= PI APPROVE ================= */

  if (!payment.status?.developer_approved) {
    await piApprovePayment(piPaymentId);
  }

  console.log("[PAYMENT][AUTHORIZE] SUCCESS");

  return { success: true };
}
