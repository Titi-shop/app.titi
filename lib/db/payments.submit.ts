
import { withTransaction } from "@/lib/db";

type MarkPaymentVerifyingInput = {
  paymentIntentId: string;
  userId: string;
  piPaymentId: string;
  txid: string;
};

type PaymentIntentRow = {
  id: string;
  buyer_id: string;
  status: string;
};

type MarkPaymentVerifyingResult = {
  ok: boolean;
  already: boolean;
  status: string;
  paymentIntentId: string;
};

export async function markPaymentVerifying({
  paymentIntentId,
  userId,
  piPaymentId,
  txid,
}: MarkPaymentVerifyingInput): Promise<MarkPaymentVerifyingResult> {
  return await withTransaction(async (client) => {
    const found = await client.query<PaymentIntentRow>(
      `
      SELECT id, buyer_id, status
      FROM payment_intents
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentIntentId]
    );

    if (!found.rows.length) {
      throw new Error("INTENT_NOT_FOUND");
    }

    const intent = found.rows[0];

    if (intent.buyer_id !== userId) {
      throw new Error("FORBIDDEN");
    }

    /* =====================================================
       IDEMPOTENT CASE
    ===================================================== */

    if (intent.status === "paid") {
      return {
        ok: true,
        already: true,
        status: "paid",
        paymentIntentId,
      };
    }

    if (intent.status === "verifying") {
      return {
        ok: true,
        already: true,
        status: "verifying",
        paymentIntentId,
      };
    }

    /* =====================================================
       STATUS GUARD
    ===================================================== */

    if (
      intent.status !== "created" &&
      intent.status !== "wallet_opened"
    ) {
      throw new Error("INVALID_STATUS");
    }

    /* =====================================================
       UPDATE VERIFYING LOCK
    ===================================================== */

    await client.query(
      `
      UPDATE payment_intents
      SET
        status = 'verifying',
        pi_payment_id = $2,
        txid = $3,
        updated_at = now()
      WHERE id = $1
      `,
      [paymentIntentId, piPaymentId, txid]
    );

    return {
      ok: true,
      already: false,
      status: "verifying",
      paymentIntentId,
    };
  });
}
