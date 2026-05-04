

import { withTransaction, query } from "@/lib/db";

/* =========================================================
   ENV
========================================================= */

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* =========================================================
   TYPES
========================================================= */

export type PiPaymentResponse = {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  from_address: string;
  to_address: string;
  status?: {
    developer_approved?: boolean;
    transaction_verified?: boolean;
    developer_completed?: boolean;
    cancelled?: boolean;
    user_cancelled?: boolean;
  };
  metadata?: Record<string, unknown>;
  transaction?: {
    txid?: string;
    verified?: boolean;
    _link?: string;
  };
};

type BindParams = {
  userId: string;
  paymentIntentId: string;
  piPaymentId: string;
  piUid: string;
  verifiedAmount: number;
  piPayload: unknown;
};

type VerifyReconcileParams = {
  paymentIntentId: string;
  piPaymentId: string;
  userId: string;
  txid: string;
};

type VerifyReconcileResult = {
  ok: boolean;
  verifiedAmount: number;
  receiverWallet: string;
  piUid: string | null;
  piPayload: unknown;
};

/* =========================================================
   HELPERS
========================================================= */

function safeNumber(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("INVALID_NUMBER");
  return n;
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.00001;
}

/* =========================================================
   VERIFY PI USER FROM TOKEN
========================================================= */

export async function verifyPiUser(authHeader: string): Promise<string> {
  console.log("🟡 [PI VERIFY V2] VERIFY_PI_USER");

  const bearer = authHeader.replace("Bearer ", "").trim();

  if (!bearer) {
    throw new Error("MISSING_PI_BEARER");
  }

  const res = await fetch(`${PI_API}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${bearer}`,
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  console.log("🟡 [PI VERIFY V2] /me RESPONSE", data);

  if (!res.ok || !data?.uid) {
    throw new Error("INVALID_PI_USER");
  }

  return String(data.uid);
}

/* =========================================================
   FETCH PI PAYMENT FROM PI SERVER
========================================================= */

export async function fetchPiPayment(
  piPaymentId: string
): Promise<PiPaymentResponse> {
  console.log("🟡 [PI VERIFY V2] FETCH_PI_PAYMENT", piPaymentId);

  const res = await fetch(`${PI_API}/payments/${piPaymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Key ${PI_KEY}`,
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  console.log("🟡 [PI VERIFY V2] PAYMENT_RESPONSE", data);

  if (!res.ok || !data?.identifier) {
    throw new Error("PI_PAYMENT_FETCH_FAILED");
  }

  return data as PiPaymentResponse;
}

/* =========================================================
   BIND PI PAYMENT TO PAYMENT INTENT
   STATUS: created/verifying/submitted -> wallet_opened
========================================================= */

export async function bindPiPaymentToIntent({
  userId,
  paymentIntentId,
  piPaymentId,
  piUid,
  verifiedAmount,
  piPayload,
}: BindParams): Promise<void> {
  await withTransaction(async (client) => {
    console.log("🟡 [PI VERIFY V2] BIND_INTENT_START", {
      paymentIntentId,
      piPaymentId,
    });

    const lock = await client.query<{
      id: string;
      buyer_id: string;
      total_amount: string;
      status: string;
      pi_payment_id: string | null;
    }>(
      `
      SELECT
        id,
        buyer_id,
        total_amount,
        status,
        pi_payment_id
      FROM payment_intents
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentIntentId]
    );

    if (!lock.rows.length) {
      throw new Error("PAYMENT_INTENT_NOT_FOUND");
    }

    const intent = lock.rows[0];

    if (intent.buyer_id !== userId) {
      throw new Error("FORBIDDEN");
    }

    if (intent.status === "paid") {
      return;
    }

    const allowedStates = [
      "created",
      "verifying",
      "submitted",
      "wallet_opened",
    ];

    if (!allowedStates.includes(intent.status)) {
      throw new Error("INVALID_PAYMENT_STATE");
    }

    if (intent.pi_payment_id && intent.pi_payment_id !== piPaymentId) {
      throw new Error("PI_PAYMENT_ALREADY_BOUND");
    }

    const expectedAmount = safeNumber(intent.total_amount);

    if (!sameAmount(expectedAmount, verifiedAmount)) {
      throw new Error("PI_AMOUNT_MISMATCH");
    }

    await client.query(
      `
      UPDATE payment_intents
      SET
        pi_payment_id = $2,
        pi_user_uid = $3,
        pi_verified_amount = $4,
        pi_payment_payload = $5,
        status = 'wallet_opened',
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
    payload,
    event_hash,
    created_at
  )
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
  `,
  [
    paymentIntentId,
    piPaymentId,
    piUid,

    crypto.randomUUID(), // nonce
    crypto.randomUUID(), // verify_token

    intent.merchant_wallet, // ✅ lấy từ DB payment_intents
    expectedAmount,         // ✅ từ intent.total_amount
    verifiedAmount,
    "PI",
    "RECEIVED",
    JSON.stringify(piPayload ?? {}),
    eventHash,
  ]
);

    console.log("🟢 [PI VERIFY V2] BIND_INTENT_OK");
  });
}

/* =========================================================
   RECONCILE VERIFY PI PAYMENT
   HARD VERIFIED + FORENSIC RECEIPT PERSIST
========================================================= */

export async function verifyPiPaymentForReconcile({
  paymentIntentId,
  piPaymentId,
  userId,
  txid,
}: VerifyReconcileParams): Promise<VerifyReconcileResult> {
  console.log("🟡 [PI RECON VERIFY V2] START", {
    paymentIntentId,
    piPaymentId,
    txid,
  });

  return withTransaction(async (client) => {
    const db = await client.query<{
      buyer_id: string;
      total_amount: string;
      merchant_wallet: string;
      status: string;
      pi_payment_id: string | null;
      pi_user_uid: string | null;
      pi_verified_amount: string | null;
    }>(
      `
      SELECT
        buyer_id,
        total_amount,
        merchant_wallet,
        status,
        pi_payment_id,
        pi_user_uid,
        pi_verified_amount
      FROM payment_intents
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentIntentId]
    );

    if (!db.rows.length) {
      throw new Error("PAYMENT_INTENT_NOT_FOUND");
    }

    const intent = db.rows[0];

    if (intent.buyer_id !== userId) {
      throw new Error("FORBIDDEN");
    }

    if (intent.pi_payment_id !== piPaymentId) {
      throw new Error("PI_PAYMENT_ID_MISMATCH");
    }

    if (intent.status === "paid") {
      return {
        ok: true,
        verifiedAmount: safeNumber(intent.pi_verified_amount ?? 0),
        receiverWallet: intent.merchant_wallet,
        piUid: intent.pi_user_uid,
        piPayload: null,
      };
    }

    const allowedStates = [
      "pending",
      "created",
      "verifying",
      "submitted",
      "wallet_opened",
    ];

    if (!allowedStates.includes(intent.status)) {
      throw new Error("INVALID_PAYMENT_STATE");
    }

    const pi = await fetchPiPayment(piPaymentId);

    if (pi.status?.cancelled || pi.status?.user_cancelled) {
      throw new Error("PI_PAYMENT_CANCELLED");
    }

    if (!pi.status?.developer_approved) {
      throw new Error("PI_NOT_APPROVED");
    }

    const expectedAmount = safeNumber(intent.total_amount);
    const piAmount = safeNumber(pi.amount);

    if (!sameAmount(expectedAmount, piAmount)) {
      throw new Error("PI_AMOUNT_MISMATCH");
    }

    const receiver = String(pi.to_address || "").trim();
    const expectedReceiver = String(intent.merchant_wallet || "").trim();

    if (!receiver || receiver !== expectedReceiver) {
      throw new Error("PI_RECEIVER_MISMATCH");
    }

    if (pi.transaction?.txid && pi.transaction.txid !== txid) {
      throw new Error("PI_TXID_MISMATCH");
    }

    /* =====================================================
       FORENSIC PI VERIFIED RECEIPT
    ===================================================== */

    await client.query(
      `
      INSERT INTO payment_receipts (
        payment_intent_id,
        user_id,
        pi_payment_id,
        pi_uid,
        txid,
        expected_amount,
        verified_amount,
        receiver_wallet,
        verification_status,
        verify_source,
        pi_payload,
        verified_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,
        'pi_verified',
        'PI_SERVER',
        $9,
        now(),
        now(),
        now()
      )
      ON CONFLICT (pi_payment_id)
      DO UPDATE SET
        txid = EXCLUDED.txid,
        expected_amount = EXCLUDED.expected_amount,
        verified_amount = EXCLUDED.verified_amount,
        receiver_wallet = EXCLUDED.receiver_wallet,
        verification_status = 'pi_verified',
        verify_source = 'PI_SERVER',
        pi_uid = EXCLUDED.pi_uid,
        pi_payload = EXCLUDED.pi_payload,
        verified_at = now(),
        updated_at = now()
      `,
      [
        paymentIntentId,
        userId,
        piPaymentId,
        pi.user_uid || null,
        txid,
        expectedAmount,
        piAmount,
        receiver,
        JSON.stringify(pi),
      ]
    );

    console.log("🟢 [PI RECON VERIFY V2] SUCCESS");

    return {
      ok: true,
      verifiedAmount: piAmount,
      receiverWallet: receiver,
      piUid: pi.user_uid || null,
      piPayload: pi,
    };
  });
}
