import { withTransaction } from "@/lib/db";
import { query } from "@/lib/db";
import { verifyPayment } from "./payments.verify";

/* =========================
   TYPES
========================= */

type SubmitInput = {
  userId: string; // UUID only
  paymentIntentId: string;
  txid: string;
  piPaymentId: string;
};

/* =========================
   MAIN SUBMIT FLOW
========================= */

export async function submitPayment(input: SubmitInput) {
  return withTransaction(async (client) => {

    /* ================= LOCK INTENT ================= */

    const intentRes = await client.query(
      `
      SELECT *
      FROM payment_intents
      WHERE id = $1 AND buyer_id = $2
      FOR UPDATE
      `,
      [input.paymentIntentId, input.userId]
    );

    if (!intentRes.rows.length) {
      throw new Error("INTENT_NOT_FOUND");
    }

    const intent = intentRes.rows[0];

    /* ================= IDEMPOTENCY ================= */

    if (intent.status === "paid") {
      return {
        ok: true,
        already: true
      };
    }

    /* ================= VERIFY ================= */

    const result = await verifyPayment({
      txid: input.txid,
      expectedAmount: Number(intent.total_amount),
      expectedReceiver: intent.merchant_wallet,
      piPaymentId: input.piPaymentId
    });

    if (!result.ok) {
      throw new Error(result.reason);
    }

    /* ================= UPDATE PI PAYMENT ================= */

    await client.query(
      `
      UPDATE pi_payments
      SET status = 'verified',
          txid = $2
      WHERE pi_payment_id = $1
      `,
      [input.piPaymentId, input.txid]
    );

    /* ================= UPDATE INTENT ================= */

    await client.query(
      `
      UPDATE payment_intents
      SET status = 'paid',
          txid = $2,
          pi_payment_id = $3,
          paid_at = now()
      WHERE id = $1
      `,
      [intent.id, input.txid, input.piPaymentId]
    );

    /* ================= CREATE ORDER ================= */

    const order = await client.query(
      `
      INSERT INTO orders (
        buyer_id,
        seller_id,
        total_amount,
        status
      )
      VALUES ($1,$2,$3,'paid')
      RETURNING id
      `,
      [
        intent.buyer_id,
        intent.seller_id,
        intent.total_amount
      ]
    );

    return {
      ok: true,
      orderId: order.rows[0].id
    };
  });
}
