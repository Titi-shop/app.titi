import { withTransaction } from "@/lib/db";
import {
  verifyPiUser,
  fetchPiPayment,
  bindPiPaymentToIntent,
} from "@/lib/db/payments.verify";
import { piApprovePayment } from "@/lib/pi/client";

type Input = {
  userId: string;
  authorizationHeader: string;
  body: any;
};

export async function piAuthorizePayment(input: Input) {
  const { userId, authorizationHeader, body } = input;

  const paymentIntentId =
    body.paymentIntentId ?? body.payment_intent_id;

  const piPaymentId =
    body.piPaymentId ?? body.pi_payment_id;

  if (!paymentIntentId || !piPaymentId) {
    throw new Error("INVALID_INPUT");
  }

  const piUid = await verifyPiUser(authorizationHeader);
  const payment = await fetchPiPayment(piPaymentId);

  if (payment.user_uid !== piUid) {
    throw new Error("PI_USER_MISMATCH");
  }

  await withTransaction(async () => {
    await bindPiPaymentToIntent({
      userId,
      paymentIntentId,
      piPaymentId,
      piUid,
      verifiedAmount: Number(payment.amount),
      piPayload: payment,
    });
  });

  if (!payment.status?.developer_approved) {
    await piApprovePayment(piPaymentId);
  }

  return { success: true };
}
