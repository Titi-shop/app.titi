import { query } from "@/lib/db/index";
import { getRpcTransaction } from "@/lib/rpc/client";

/* =========================================================
   TYPES
========================================================= */

type VerifyRpcParams = {
  paymentIntentId: string;
  txid: string;
};

type RpcStage =
  | "RPC_OK"
  | "RPC_UNREACHABLE"
  | "RPC_PARSE_FAIL"
  | "RPC_VALIDATION_FAIL";

type RpcFailReason =
  | "RPC_UNREACHABLE"
  | "TX_NOT_CONFIRMED"
  | "AMOUNT_NOT_FOUND"
  | "AMOUNT_MISMATCH"
  | "RECEIVER_NOT_FOUND"
  | "RECEIVER_MISMATCH"
  | null;

type RpcVerifyResult = {
  ok: boolean;
  audited: boolean;

  amount: number | null;
  sender: string | null;
  receiver: string | null;
  ledger: number | null;

  confirmed: boolean;
  chainReference: string | null;

  stage: RpcStage;
  reason: RpcFailReason;

  payload: unknown;
};

type PaymentIntentRow = {
  id: string;
  total_amount: string;
  merchant_wallet: string | null;
};

/* =========================================================
   UTIL
========================================================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

function normalizeWallet(v: string | null): string {
  return (v ?? "").trim().toLowerCase();
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0000001;
}

/* =========================================================
   DB
========================================================= */

async function getPaymentIntent(
  paymentIntentId: string
): Promise<PaymentIntentRow | null> {
  const rs = await query<PaymentIntentRow>(
    `
    SELECT id, total_amount, merchant_wallet
    FROM payment_intents
    WHERE id = $1
    LIMIT 1
    `,
    [paymentIntentId]
  );

  return rs.rows[0] || null;
}

/* =========================================================
   LOG
========================================================= */

async function insertRpcLog(input: {
  paymentIntentId: string;
  txid: string;
  verified: boolean;
  stage: RpcStage;
  reason: RpcFailReason;

  amount: number | null;
  sender: string | null;
  receiver: string | null;
  ledger: number | null;
  txStatus: string | null;
  chainReference: string | null;

  payload: unknown;
}) {
  await query(
    `
    INSERT INTO rpc_verification_logs (
      payment_intent_id,
      txid,
      verified,
      stage,
      reason,
      amount,
      sender,
      receiver,
      ledger,
      tx_status,
      chain_reference,
      verify_mode,
      payload
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'raw_tx',$12::jsonb
    )
    ON CONFLICT (txid)
    DO UPDATE SET
      verified = EXCLUDED.verified,
      stage = EXCLUDED.stage,
      reason = EXCLUDED.reason,
      amount = EXCLUDED.amount,
      sender = EXCLUDED.sender,
      receiver = EXCLUDED.receiver,
      ledger = EXCLUDED.ledger,
      tx_status = EXCLUDED.tx_status,
      chain_reference = EXCLUDED.chain_reference,
      payload = EXCLUDED.payload
    `,
    [
      input.paymentIntentId,
      input.txid,
      input.verified,
      input.stage,
      input.reason,
      input.amount,
      input.sender,
      input.receiver,
      input.ledger,
      input.txStatus,
      input.chainReference,
      JSON.stringify(input.payload ?? {}),
    ]
  );
}

/* =========================================================
   MAIN
========================================================= */

export async function verifyRpcPaymentV3({
  paymentIntentId,
  txid,
}: VerifyRpcParams): Promise<RpcVerifyResult> {
  console.log("[RPC V3] START", { paymentIntentId, txid });

  /* =====================================================
     STEP 1 — LOAD INTENT
  ===================================================== */

  const intent = await getPaymentIntent(paymentIntentId);

  if (!intent) {
    throw new Error("PAYMENT_INTENT_NOT_FOUND");
  }

  const expectedAmount = Number(intent.total_amount);
  const expectedReceiver = normalizeWallet(intent.merchant_wallet);

  /* =====================================================
     STEP 2 — FETCH RPC
  ===================================================== */

  let rpcTx;

  try {
    rpcTx = await getRpcTransaction(txid);
  } catch (err) {
    await insertRpcLog({
      paymentIntentId,
      txid,
      verified: false,
      stage: "RPC_UNREACHABLE",
      reason: "RPC_UNREACHABLE",
      amount: null,
      sender: null,
      receiver: null,
      ledger: null,
      txStatus: null,
      chainReference: null,
      payload: {},
    });

    return {
      ok: false,
      audited: true,
      amount: null,
      sender: null,
      receiver: null,
      ledger: null,
      confirmed: false,
      chainReference: null,
      stage: "RPC_UNREACHABLE",
      reason: "RPC_UNREACHABLE",
      payload: {},
    };
  }

  /* =====================================================
     STEP 3 — PARSE VALIDATION
  ===================================================== */

  const confirmed = rpcTx.status === "confirmed";

  let verified = true;
  let stage: RpcStage = "RPC_OK";
  let reason: RpcFailReason = null;

  const hasData =
    rpcTx.amount !== null ||
    rpcTx.sender !== null ||
    rpcTx.receiver !== null;

  if (!hasData) {
    verified = false;
    stage = "RPC_PARSE_FAIL";
    reason = "AMOUNT_NOT_FOUND";
  }

  if (verified && !confirmed) {
    verified = false;
    stage = "RPC_VALIDATION_FAIL";
    reason = "TX_NOT_CONFIRMED";
  }

  if (verified && rpcTx.amount !== null && !sameAmount(rpcTx.amount, expectedAmount)) {
    verified = false;
    stage = "RPC_VALIDATION_FAIL";
    reason = "AMOUNT_MISMATCH";
  }

  if (verified && !rpcTx.receiver) {
    verified = false;
    stage = "RPC_VALIDATION_FAIL";
    reason = "RECEIVER_NOT_FOUND";
  }

  if (
    verified &&
    rpcTx.receiver &&
    normalizeWallet(rpcTx.receiver) !== expectedReceiver
  ) {
    verified = false;
    stage = "RPC_VALIDATION_FAIL";
    reason = "RECEIVER_MISMATCH";
  }

  /* =====================================================
     STEP 4 — WRITE LOG (ALWAYS)
  ===================================================== */

  await insertRpcLog({
    paymentIntentId,
    txid,
    verified,
    stage,
    reason,

    amount: rpcTx.amount,
    sender: rpcTx.sender,
    receiver: rpcTx.receiver,
    ledger: rpcTx.ledger,
    txStatus: rpcTx.status,
    chainReference: rpcTx.hash,
    payload: rpcTx.raw,
  });

  console.log("[RPC V3] DONE", {
    verified,
    stage,
    reason,
    amount: rpcTx.amount,
  });

  /* =====================================================
     RESULT
  ===================================================== */

  return {
    ok: verified,
    audited: true,

    amount: rpcTx.amount,
    sender: rpcTx.sender,
    receiver: rpcTx.receiver,
    ledger: rpcTx.ledger,

    confirmed,

    chainReference: rpcTx.hash,

    stage,
    reason,

    payload: rpcTx.raw,
  };
}
