import { withTransaction } from "@/lib/db";

export async function bindPiPaymentToIntent(params: any): Promise<void> {
  return withTransaction(async (client) => {
    const {
      userId,
      paymentIntentId,
      piPaymentId,
      piUid,
      verifiedAmount,
      piPayload,
    } = params;

    const lock = await client.query(
      `
      SELECT id, buyer_id, status, pi_payment_id
      FROM payment_intents
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentIntentId]
    );

    if (!lock.rows.length) throw new Error("PAYMENT_INTENT_NOT_FOUND");

    const intent = lock.rows[0];

    if (intent.buyer_id !== userId) throw new Error("FORBIDDEN");

    if (intent.status === "paid") return;

    if (intent.pi_payment_id && intent.pi_payment_id !== piPaymentId) {
      throw new Error("PI_PAYMENT_ALREADY_BOUND");
    }

    await client.query(
      `
      UPDATE payment_intents
      SET
        pi_payment_id = $2,
        pi_user_uid = $3,
        pi_verified_amount = $4,
        pi_payment_payload = $5,
        status = 'authorized',
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
