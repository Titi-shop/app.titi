import { query } from "@/lib/db";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

export async function verifyPiUser(authHeader: string) {
  console.log("🟡 [VERIFY] VERIFY_PI_USER");

  const meRes = await fetch("https://api.minepi.com/v2/me", {
    headers: {
      Authorization: authHeader,
    },
    cache: "no-store",
  });

  if (!meRes.ok) {
    console.error("❌ [VERIFY] INVALID_PI_TOKEN");
    throw new Error("INVALID_PI_TOKEN");
  }

  const me = await meRes.json();

  if (!me?.uid) {
    console.error("❌ [VERIFY] INVALID_PI_USER", me);
    throw new Error("INVALID_PI_USER");
  }

  console.log("🟢 [VERIFY] PI_USER_OK", me.uid);

  return me.uid as string;
}

export async function fetchPiPayment(piPaymentId: string) {
  console.log("🟡 [VERIFY] FETCH_PI_PAYMENT", piPaymentId);

  const piRes = await fetch(`${PI_API}/payments/${piPaymentId}`, {
    headers: {
      Authorization: `Key ${PI_KEY}`,
    },
    cache: "no-store",
  });

  if (!piRes.ok) {
    console.error("❌ [VERIFY] PI_PAYMENT_NOT_FOUND", piPaymentId);
    throw new Error("PI_PAYMENT_NOT_FOUND");
  }

  const payment = await piRes.json();

  console.log("🟢 [VERIFY] PI_PAYMENT_FETCHED", {
    amount: payment.amount,
    from: payment.from_address,
    to: payment.to_address,
  });

  return payment;
}

export function assertPiPaymentReady(params: {
  payment: any;
  piUid: string;
}) {
  const { payment, piUid } = params;

  if (!payment.amount || Number(payment.amount) <= 0) {
    throw new Error("INVALID_PI_AMOUNT");
  }

  if (payment.user_uid !== piUid) {
    console.error("❌ [VERIFY] USER_MISMATCH", {
      paymentUser: payment.user_uid,
      tokenUser: piUid,
    });
    throw new Error("INVALID_PI_USER");
  }

  const status = payment.status;

  if (!status?.developer_approved) {
    throw new Error("PAYMENT_NOT_APPROVED_BY_MERCHANT");
  }

  if (!payment.transaction?.txid) {
    throw new Error("TXID_NOT_READY");
  }

  if (!status?.transaction_verified) {
    throw new Error("BLOCKCHAIN_NOT_VERIFIED");
  }

  console.log("🟢 [VERIFY] PI_PAYMENT_READY");
}


export async function bindPiPaymentToIntent(
  client: any,
  params: {
    userId: string;
    paymentIntentId: string;
    piPaymentId: string;
    piUid: string;
    verifiedAmount: number;
    piPayload: any;
  }
) {
  console.log("🟡 [DB] bindPiPaymentToIntent START", params);

  const {
    userId,
    paymentIntentId,
    piPaymentId,
    piUid,
    verifiedAmount,
    piPayload,
  } = params;

  // 1. lock payment intent
  const intent = await client.query(
    `SELECT * FROM payment_intents WHERE id = $1 FOR UPDATE`,
    [paymentIntentId]
  );

  if (!intent.rows.length) {
    throw new Error("PAYMENT_INTENT_NOT_FOUND");
  }

  const data = intent.rows[0];

  if (data.status === "paid") {
    throw new Error("ALREADY_PAID");
  }

  // 2. update intent → pending approval state
  await client.query(
    `
    UPDATE payment_intents
    SET
      pi_payment_id = $1,
      pi_uid = $2,
      amount_verified = $3,
      status = 'processing',
      pi_payload = $4,
      updated_at = NOW()
    WHERE id = $5
    `,
    [piPaymentId, piUid, verifiedAmount, piPayload, paymentIntentId]
  );

  console.log("🟢 [DB] bind OK");

  return { ok: true };
}
