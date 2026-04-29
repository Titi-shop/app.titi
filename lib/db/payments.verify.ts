import { query } from "@/lib/db";

/* =========================================================
   ENV
========================================================= */

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* =========================================================
   TYPES
========================================================= */

type VerifyPiParams = {
  paymentIntentId: string;
  userId: string;
  piPaymentId: string;
};

type PiPaymentResponse = {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  from_address: string;
  to_address: string;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
  transaction?: {
    txid?: string;
    verified?: boolean;
    _link?: string;
  };
  metadata?: Record<string, unknown>;
};

/* =========================================================
   HELPERS
========================================================= */

function safeNumber(v: unknown): number {
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error("INVALID_NUMBER");
  return n;
}

async function fetchPiPayment(piPaymentId: string): Promise<PiPaymentResponse> {
  console.log("🟡 [PI_VERIFY] FETCH_PI_PAYMENT", piPaymentId);

  const res = await fetch(`${PI_API}/payments/${piPaymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Key ${PI_KEY}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("🔥 [PI_VERIFY] PI_FETCH_FAIL", res.status);
    throw new Error("PI_PAYMENT_FETCH_FAILED");
  }

  const data = await res.json();

  console.log("🟢 [PI_VERIFY] PI_FETCH_OK", {
    identifier: data?.identifier,
    amount: data?.amount,
    to: data?.to_address,
    approved: data?.status?.developer_approved,
    completed: data?.status?.developer_completed,
    tx_verified: data?.status?.transaction_verified,
  });

  return data;
}

/* =========================================================
   MAIN VERIFY
========================================================= */

export async function verifyPiPaymentForReconcile({
  paymentIntentId,
  userId,
  piPaymentId,
}: VerifyPiParams) {
  console.log("🟡 [PI_VERIFY] START", {
    paymentIntentId,
    userId,
    piPaymentId,
  });

  /* =========================
     DB SNAPSHOT
  ========================= */

  const db = await query<{
    id: string;
    buyer_id: string;
    total_amount: string;
    merchant_wallet: string;
    pi_payment_id: string | null;
    status: string;
  }>(
    `
    SELECT
      id,
      buyer_id,
      total_amount,
      merchant_wallet,
      pi_payment_id,
      status
    FROM payment_intents
    WHERE id = $1
    LIMIT 1
    `,
    [paymentIntentId]
  );

  if (!db.rows.length) {
    console.error("🔥 [PI_VERIFY] INTENT_NOT_FOUND");
    throw new Error("PAYMENT_INTENT_NOT_FOUND");
  }

  const intent = db.rows[0];

  console.log("🟡 [PI_VERIFY] DB_INTENT", intent);

  if (intent.buyer_id !== userId) {
    throw new Error("FORBIDDEN");
  }

  if (!intent.pi_payment_id || intent.pi_payment_id !== piPaymentId) {
    throw new Error("PI_PAYMENT_ID_MISMATCH");
  }

  if (
    intent.status !== "verifying" &&
    intent.status !== "submitted" &&
    intent.status !== "wallet_opened"
  ) {
    throw new Error("INVALID_PAYMENT_STATE");
  }

  /* =========================
     FETCH PI PLATFORM PAYMENT
  ========================= */

  const pi = await fetchPiPayment(piPaymentId);

  /* =========================
     BASIC CHECKS
  ========================= */

  if (!pi.identifier || pi.identifier !== piPaymentId) {
    throw new Error("PI_IDENTIFIER_INVALID");
  }

  if (pi.status?.cancelled || pi.status?.user_cancelled) {
    throw new Error("PI_PAYMENT_CANCELLED");
  }

  if (!pi.status?.developer_approved) {
    throw new Error("PI_NOT_APPROVED");
  }

  if (pi.status?.developer_completed) {
    console.log("🟡 [PI_VERIFY] ALREADY_COMPLETED_ON_PI");
  }

  const expectedAmount = safeNumber(intent.total_amount);
  const piAmount = safeNumber(pi.amount);

  console.log("🟡 [PI_VERIFY] AMOUNT_COMPARE", {
    expectedAmount,
    piAmount,
  });

  if (Number(expectedAmount.toFixed(7)) !== Number(piAmount.toFixed(7))) {
    throw new Error("PI_AMOUNT_MISMATCH");
  }

  const expectedReceiver = String(intent.merchant_wallet).trim();
  const piReceiver = String(pi.to_address || "").trim();

  console.log("🟡 [PI_VERIFY] RECEIVER_COMPARE", {
    expectedReceiver,
    piReceiver,
  });

  if (!piReceiver || piReceiver !== expectedReceiver) {
    throw new Error("PI_RECEIVER_MISMATCH");
  }

  console.log("🟢 [PI_VERIFY] VERIFIED_SUCCESS");

  return {
    ok: true,
    piPayload: pi,
    verifiedAmount: piAmount,
    receiverWallet: piReceiver,
  };
}
