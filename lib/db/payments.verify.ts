import { query } from "@/lib/db";

/* =========================================================
   ENV
========================================================= */

const PI_API = "https://api.minepi.com/v2";
const PI_KEY = process.env.PI_SERVER_API_KEY!;

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
  amount: number;
  memo: string;
  from_address: string;
  to_address: string;
  metadata?: Record<string, unknown>;
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

  const data = await res.json().catch(() => null);

  if (!res.ok || !data) {
    console.error("🔥 [PI_VERIFY] PI_FETCH_FAIL", res.status);
    throw new Error("PI_PAYMENT_FETCH_FAILED");
  }

  console.log("🟢 [PI_VERIFY] PI_FETCH_OK", {
    identifier: data?.identifier,
    amount: data?.amount,
    to: data?.to_address,
    approved: data?.status?.developer_approved,
    completed: data?.status?.developer_completed,
    tx_verified: data?.status?.transaction_verified,
    txid: data?.transaction?.txid,
  });

  return data;
}

/* =========================================================
   MAIN
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

  const pi = await fetchPiPayment(piPaymentId);

  if (!pi.identifier || pi.identifier !== piPaymentId) {
    throw new Error("PI_IDENTIFIER_INVALID");
  }

  if (pi.status?.cancelled || pi.status?.user_cancelled) {
    throw new Error("PI_PAYMENT_CANCELLED");
  }

  if (!pi.status?.developer_approved) {
    throw new Error("PI_NOT_APPROVED");
  }

  if (!pi.transaction?.txid) {
    throw new Error("PI_TXID_NOT_FOUND");
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
    txid: String(pi.transaction.txid),
    verifiedAmount: piAmount,
    receiverWallet: piReceiver,
    piPayload: pi,
  };
}
