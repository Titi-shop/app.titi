import { withTransaction } from "@/lib/db";

/* =========================================================
   BIND PI PAYMENT → PAYMENT INTENT
========================================================= */

export async function bindPiPaymentToIntent(params: {
  userId: string;
  paymentIntentId: string;
  piPaymentId: string;
  piUid: string;
  verifiedAmount: number;
  piPayload: unknown;
}): Promise<void> {
  return withTransaction(async (client) => {
    const {
      userId,
      paymentIntentId,
      piPaymentId,
      piUid,
      verifiedAmount,
      piPayload,
    } = params;

    /* =====================================================
       1. FAST CHECK (NO LOCK FIRST → AVOID 55P03)
    ===================================================== */

    const preCheck = await client.query(
      `
      SELECT id, buyer_id, status, pi_payment_id
      FROM payment_intents
      WHERE id = $1
      `,
      [paymentIntentId]
    );

    if (!preCheck.rows.length) {
      throw new Error("PAYMENT_INTENT_NOT_FOUND");
    }

    const intent = preCheck.rows[0];

    if (intent.buyer_id !== userId) {
      throw new Error("FORBIDDEN");
    }

    if (intent.status === "paid") {
      return;
    }

    if (
      intent.pi_payment_id &&
      intent.pi_payment_id !== piPaymentId
    ) {
      throw new Error("PI_PAYMENT_ALREADY_BOUND");
    }

    /* =====================================================
       2. LOCK ONLY WHEN NECESSARY (SHORT CRITICAL SECTION)
    ===================================================== */

    const lock = await client.query(
      `
      SELECT id
      FROM payment_intents
      WHERE id = $1
      FOR UPDATE SKIP LOCKED
      `,
      [paymentIntentId]
    );

    if (!lock.rows.length) {
      throw new Error("LOCK_FAILED");
    }

    /* =====================================================
       3. UPDATE ONLY (NO EXTRA QUERY)
    ===================================================== */

    await client.query(
      `
      UPDATE payment_intents
      SET
        pi_payment_id = COALESCE(pi_payment_id, $2),
        pi_user_uid = $3,
        pi_verified_amount = $4,
        pi_payment_payload = $5,
        status = CASE
          WHEN status = 'paid' THEN status
          ELSE 'authorized'
        END,
        updated_at = now()
      WHERE id = $1
      `,
      [
        paymentIntentId,
        piPaymentId,
        piUid,
        verifiedAmount,
        JSON.stringify(piPayload ?? {}),
      ]
    );
  });
}
