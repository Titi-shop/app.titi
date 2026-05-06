import { bindPiPaymentToIntent } from "@/lib/db/payments.bind";
import {
  piGetMe,
  piGetPayment,
  piApprovePayment,
} from "@/lib/pi/client";
import { withTransaction } from "@/lib/db";

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
   MAIN SERVICE
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
    body.paymentIntentId ?? body.payment_intent_id ?? null;

  const piPaymentId =
    body.piPaymentId ?? body.pi_payment_id ?? null;

  if (!paymentIntentId || !piPaymentId) {
    console.error("[PAYMENT][AUTHORIZE] INVALID_INPUT", body);
    throw new Error("INVALID_INPUT");
  }

  return withTransaction(async (client) => {
    /* =====================================================
       1. VERIFY PI USER
    ===================================================== */

    console.log("[PAYMENT][AUTHORIZE] FETCH_PI_USER");

    const me = await piGetMe(authorizationHeader);

    console.log("[PAYMENT][AUTHORIZE] PI_USER_OK", {
      uid: me.uid,
    });

    /* =====================================================
       2. FETCH PI PAYMENT
    ===================================================== */

    const payment = await piGetPayment(piPaymentId);

    console.log("[PAYMENT][AUTHORIZE] PI_PAYMENT_FETCHED", {
      piPaymentId,
      amount: payment.amount,
      user_uid: payment.user_uid,
      status: payment.status,
    });

    if (payment.user_uid !== me.uid) {
      console.error("[PAYMENT][AUTHORIZE] USER_MISMATCH", {
        expected: me.uid,
        got: payment.user_uid,
      });
      throw new Error("PI_USER_MISMATCH");
    }

    /* =====================================================
       3. CHECK DUPLICATE AUTHORIZE (IDEMPOTENT)
    ===================================================== */

    const existing = await client.query(
      `
      SELECT id, status
      FROM payment_intents
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentIntentId]
    );

    if (!existing.rows.length) {
      console.error("[PAYMENT][AUTHORIZE] INTENT_NOT_FOUND");
      throw new Error("PAYMENT_INTENT_NOT_FOUND");
    }

    const intent = existing.rows[0];

    if (intent.status === "paid") {
      console.log("[PAYMENT][AUTHORIZE] ALREADY_PAID_SKIP");
      return { success: true };
    }

    if (intent.status === "authorized") {
      console.log("[PAYMENT][AUTHORIZE] ALREADY_AUTHORIZED_SKIP");
      return { success: true };
    }

    /* =====================================================
       4. BIND PI PAYMENT TO INTENT
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
       5. UPDATE STATE → AUTHORIZED
    ===================================================== */

    await client.query(
      `
      UPDATE payment_intents
      SET status = 'authorized',
          updated_at = now()
      WHERE id = $1
      `,
      [paymentIntentId]
    );

    console.log("[PAYMENT][AUTHORIZE] STATE_UPDATED");

    /* =====================================================
       6. APPROVE PI PAYMENT
    ===================================================== */

    if (!payment.status?.developer_approved) {
      console.log("[PAYMENT][AUTHORIZE] PI_APPROVE_START");

      await piApprovePayment(piPaymentId);

      console.log("[PAYMENT][AUTHORIZE] PI_APPROVE_DONE");
    } else {
      console.log("[PAYMENT][AUTHORIZE] PI_ALREADY_APPROVED");
    }

    /* =====================================================
       7. OPTIONAL AUDIT LOG (NON-BLOCKING)
    ===================================================== */

    try {
      await client.query(
        `
        INSERT INTO payment_authorize_logs (
          payment_intent_id,
          pi_payment_id,
          pi_uid,
          event_type,
          payload,
          created_at
        )
        VALUES ($1,$2,$3,'AUTHORIZED',$4,now())
        `,
        [
          paymentIntentId,
          piPaymentId,
          me.uid,
          JSON.stringify({
            amount: payment.amount,
            status: payment.status,
          }),
        ]
      );

      console.log("[PAYMENT][AUTHORIZE] AUDIT_LOG_SAVED");
    } catch (e) {
      console.warn("[PAYMENT][AUTHORIZE] AUDIT_LOG_FAILED", e);
    }

    /* =====================================================
       8. FINAL SUCCESS
    ===================================================== */

    console.log("[PAYMENT][AUTHORIZE] SUCCESS", {
      paymentIntentId,
      piPaymentId,
    });

    return { success: true };
  });
}
