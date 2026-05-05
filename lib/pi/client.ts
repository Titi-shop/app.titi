import { withTransaction } from "@/lib/db";
import {
  verifyPiUser,
  fetchPiPayment,
  bindPiPaymentToIntent,
} from "@/lib/db/payments.verify";

import { piApprovePayment } from "./client"; // reuse existing function

/* =========================================================
   AUTHORIZATION ORCHESTRATOR
   THIS REPLACES ALL LOGIC FROM ROUTE
========================================================= */

export async function piAuthorizePayment(input: {
  userId: string;
  paymentIntentId: string;
  piPaymentId: string;
  authorizationHeader: string;
}) {
  const { userId, paymentIntentId, piPaymentId, authorizationHeader } =
    input;

  /* =========================
     VERIFY PI USER
  ========================= */

  const piUid = await verifyPiUser(authorizationHeader);

  /* =========================
     FETCH PAYMENT
  ========================= */

  const payment = await fetchPiPayment(piPaymentId);

  if (payment.user_uid !== piUid) {
    throw new Error("PI_USER_MISMATCH");
  }

  /* =========================
     DB BIND (TRANSACTION ONLY HERE)
  ========================= */

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

  /* =========================
     APPROVE PI (SIDE EFFECT)
  ========================= */

  if (!payment.status?.developer_approved) {
    await piApprovePayment(piPaymentId);
  }

  return {
    success: true,
  };
}
