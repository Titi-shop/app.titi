
import { withTransaction } from "@/lib/db";
import { createHash, randomUUID } from "crypto";
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

type PiUidLogRow = {
  pi_uid: string;
};

type PrevHashRow = {
  event_hash: string;
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
    /* =====================================================
       1. LOCK PAYMENT INTENT
    ===================================================== */

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

    /* =====================================================
       2. FAST IDEMPOTENT RETURN
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
       3. STATUS ALLOWLIST
    ===================================================== */

    if (
      intent.status !== "created" &&
      intent.status !== "wallet_opened"
    ) {
      throw new Error("INVALID_STATUS");
    }

    /* =====================================================
       4. GLOBAL REPLAY CHECK PI PAYMENT ID
    ===================================================== */

    const dupPi = await client.query<{ id: string }>(
      `
      SELECT id
      FROM payment_intents
      WHERE pi_payment_id = $1
        AND id <> $2
      LIMIT 1
      `,
      [piPaymentId, paymentIntentId]
    );

    if (dupPi.rows.length) {
      throw new Error("PI_PAYMENT_REPLAY_BLOCKED");
    }

    /* =====================================================
       5. GLOBAL REPLAY CHECK TXID
    ===================================================== */

    const dupTx = await client.query<{ id: string }>(
      `
      SELECT id
      FROM payment_intents
      WHERE txid = $1
        AND id <> $2
      LIMIT 1
      `,
      [txid, paymentIntentId]
    );

    if (dupTx.rows.length) {
      throw new Error("TXID_REPLAY_BLOCKED");
    }

    /* =====================================================
       6. LOAD PI UID FROM AUTHORIZE EVIDENCE
    ===================================================== */

    const piUidRes = await client.query<PiUidLogRow>(
      `
      SELECT pi_uid
      FROM payment_authorize_logs
      WHERE payment_intent_id = $1
      ORDER BY auth_index DESC
      LIMIT 1
      `,
      [paymentIntentId]
    );

    const piUid = piUidRes.rows[0]?.pi_uid ?? null;

    if (!piUid) {
      throw new Error("PI_UID_NOT_BOUND");
    }

    /* =====================================================
       7. PREVIOUS HASH CHAIN
    ===================================================== */

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

    const submitPayload = {
      paymentIntentId,
      userId,
      piUid,
      piPaymentId,
      txid,
      nonce: intent.nonce,
      verifyToken: intent.verify_token,
      merchantWallet: intent.merchant_wallet,
      amount: Number(intent.total_amount),
      prevHash,
      salt: randomUUID(),
      stage: "client_submit_verifying",
    };

    const eventHash = makeHash(submitPayload);

    /* =====================================================
       8. IMMUTABLE SUBMIT EVIDENCE APPEND
       (reuse same audit chain table intentionally)
    ===================================================== */

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
    $1,$2,$3,$4,$5,$6,
    $7,$8,$9,
    'VERIFIED',
    $10,
    'client_submit',
    $11,
    $12,
    $13
  )
  `,
      [
        paymentIntentId,
        piPaymentId,
        piUid,
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
          stage: "submit",
        }),
        prevHash,
        eventHash,
      ]
    );

    /* =====================================================
       9. MOVE INTENT -> VERIFYING
    ===================================================== */

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
