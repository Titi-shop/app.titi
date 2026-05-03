import { withTransaction } from "@/lib/db";

type DbClient = {
  query: <T = unknown>(
    text: string,
    params?: readonly unknown[]
  ) => Promise<{
    rows: T[];
  }>;
};

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
  txid: string | null;
  pi_payment_id: string | null;
};

type MarkPaymentVerifyingResult = {
  ok: boolean;
  already: boolean;
  status: string;
  paymentIntentId: string;
};

async function insertSubmitAudit(
  client: DbClient,
  input: {
    paymentIntentId: string;
    userId: string;
    piPaymentId: string;
    txid: string;
  }
): Promise<void> {
  await client.query(
    `
    INSERT INTO payment_audit_logs (
      payment_intent_id,
      stage,
      severity,
      source,
      reason,
      payload,
      created_at
    )
    VALUES (
      $1,
      'SUBMIT',
      'info',
      'client_submit',
      'TX_SUBMITTED',
      $2::jsonb,
      now()
    )
    `,
    [
      input.paymentIntentId,
      JSON.stringify({
        userId: input.userId,
        piPaymentId: input.piPaymentId,
        txid: input.txid,
      }),
    ]
  );
}
export async function markPaymentVerifying({
  paymentIntentId,
  userId,
  piPaymentId,
  txid,
}: MarkPaymentVerifyingInput): Promise<MarkPaymentVerifyingResult> {
  return await withTransaction(async (client) => {
    const found = await client.query<PaymentIntentRow>(
      `
      SELECT id, buyer_id, status, txid, pi_payment_id
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

    bfnf

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
