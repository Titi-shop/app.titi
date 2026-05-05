
import { withTransaction } from "@/lib/db";
import { createHash } from "crypto";

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
  nonce: string;
  verify_token: string;
  merchant_wallet: string;
  total_amount: string;
  currency: string;
};

type PrevHashRow = {
  event_hash: string | null;
};

type MarkPaymentVerifyingResult = {
  ok: boolean;
  already: boolean;
  status: string;
  paymentIntentId: string;
};

function makeHash(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

export async function markPaymentVerifying({
  paymentIntentId,
  userId,
  piPaymentId,
  txid,
}: MarkPaymentVerifyingInput): Promise<MarkPaymentVerifyingResult> {
  return withTransaction(async (client) => {
    const found = await client.query<PaymentIntentRow>(
      `
      SELECT
        id,
        buyer_id,
        status,
        nonce,
        verify_token,
        merchant_wallet,
        total_amount,
        currency
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

    if (intent.status === "paid" || intent.status === "verifying") {
      return {
        ok: true,
        already: true,
        status: intent.status,
        paymentIntentId,
      };
    }

    if (
      intent.status !== "created" &&
      intent.status !== "wallet_opened"
    ) {
      throw new Error("INVALID_STATUS");
    }

    const replay = await client.query<{ id: string }>(
      `
      SELECT id
      FROM payment_intents
      WHERE id <> $1
        AND (
          pi_payment_id = $2
          OR txid = $3
        )
      LIMIT 1
      `,
      [paymentIntentId, piPaymentId, txid]
    );

    if (replay.rows.length) {
      throw new Error("PAYMENT_REPLAY_BLOCKED");
    }

    const prevHashRes = await client.query<PrevHashRow>(
      `
      SELECT event_hash
      FROM payment_authorize_logs
      WHERE payment_intent_id = $1
      ORDER BY auth_index DESC
      LIMIT 1
      `,
      [paymentIntentId]
    );

    const prevHash = prevHashRes.rows[0]?.event_hash ?? null;

    const eventHash = makeHash({
      paymentIntentId,
      userId,
      piPaymentId,
      txid,
      nonce: intent.nonce,
      verifyToken: intent.verify_token,
      merchantWallet: intent.merchant_wallet,
      amount: Number(intent.total_amount),
      prevHash,
    });

    await client.query(
      `
      INSERT INTO payment_authorize_logs (
        payment_intent_id,
        pi_payment_id,
        pi_uid,
        nonce,
        verify_token,
        merchant_wallet,
        expected_amount,
        verified_amount,
        currency,
        authorize_status,
        idempotency_fingerprint,
        source,
        payload,
        prev_hash,
        event_hash
      )
      VALUES (
        $1,$2,NULL,$3,$4,$5,
        $6,$7,$8,
        'VERIFIED',
        $9,
        'client_submit',
        $10,
        $11,
        $12
      )
      `,
      [
        paymentIntentId,
        piPaymentId,
        intent.nonce,
        intent.verify_token,
        intent.merchant_wallet,
        intent.total_amount,
        intent.total_amount,
        intent.currency,
        `${piPaymentId}:${txid}:${paymentIntentId}`,
        JSON.stringify({
          txid,
          status_before: intent.status,
          submitter_user_id: userId,
        }),
        prevHash,
        eventHash,
      ]
    );

    await client.query(
      `
      UPDATE payment_intents
      SET
        status = 'verifying',
        settlement_state = 'UNSETTLED',
        pi_payment_id = $2,
        txid = $3,
        reconcile_attempts = reconcile_attempts + 1,
        last_reconcile_at = now(),
        settlement_lock_id = gen_random_uuid(),
        settlement_locked_at = now(),
        settlement_lock_source = 'client_submit',
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
