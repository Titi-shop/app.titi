import { query } from "@/lib/db";
import { getRpcTransaction } from "@/lib/rpc/client";

/* =========================================================
   TYPES
========================================================= */

type VerifyRpcParams = {
  paymentIntentId: string;
  txid: string;
};

type RpcVerifyResult = {
  ok: boolean;
  audited: boolean;
  verified: boolean;
  amount: number | null;
  sender: string | null;
  receiver: string | null;
  ledger: number | null;
  confirmed: boolean;
  chainReference: string | null;
  payload: unknown;
  reason: string | null;
  stage: string;
};

type PaymentIntentRow = {
  id: string;
  total_amount: string;
  merchant_wallet: string | null;
};

/* =========================================================
   LOG HELPER (UNIFIED)
========================================================= */

function log(tag: string, data?: unknown) {
  console.log(`[RPC V4][${tag}]`, data ?? "");
}

function warn(tag: string, data?: unknown) {
  console.warn(`[RPC V4][${tag}]`, data ?? "");
}

function err(tag: string, data?: unknown) {
  console.error(`[RPC V4][${tag}]`, data ?? "");
}

/* =========================================================
   UTILS
========================================================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
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

async function getPaymentIntent(id: string): Promise<PaymentIntentRow | null> {
  log("DB_FETCH_INTENT_START", { id });

  const rs = await query<PaymentIntentRow>(
    `
    SELECT id, total_amount, merchant_wallet
    FROM payment_intents
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  const row = rs.rows[0] || null;

  log("DB_FETCH_INTENT_RESULT", row);

  return row;
}

/* =========================================================
   LOG INSERT
========================================================= */

async function insertRpcLog(input: {
  paymentIntentId: string;
  txid: string;
  verified: boolean;
  stage: string;
  reason: string | null;
  amount: number | null;
  sender: string | null;
  receiver: string | null;
  ledger: number | null;
  txStatus: string | null;
  chainReference: string | null;
  payload: unknown;
}) {
  log("DB_LOG_INSERT", {
    txid: input.txid,
    stage: input.stage,
    verified: input.verified,
    reason: input.reason,
  });

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
   MAIN RPC V4
========================================================= */

export async function verifyRpcPaymentForReconcile({
  paymentIntentId,
  txid,
}: VerifyRpcParams): Promise<RpcVerifyResult> {
  log("START", { paymentIntentId, txid });

  if (!isUUID(paymentIntentId) || !txid?.trim()) {
    err("INVALID_INPUT", { paymentIntentId, txid });
    throw new Error("INVALID_RPC_VERIFY_INPUT");
  }

  /* =====================================================
     LOAD INTENT
  ===================================================== */

  const intent = await getPaymentIntent(paymentIntentId);

  if (!intent) {
    err("INTENT_NOT_FOUND", { paymentIntentId });
    throw new Error("PAYMENT_INTENT_NOT_FOUND");
  }

  const expectedAmount = Number(intent.total_amount);
  const expectedReceiver = normalizeWallet(intent.merchant_wallet);

  log("INTENT_EXPECTED", {
    expectedAmount,
    expectedReceiver,
  });

  /* =====================================================
     RPC FETCH
  ===================================================== */

  log("RPC_FETCH_START", { txid });

  const rpcTx = await getRpcTransaction(txid);

  log("RPC_RAW_RESULT", {
    confirmed: rpcTx.confirmed,
    amount: rpcTx.amount,
    sender: rpcTx.sender,
    receiver: rpcTx.receiver,
    ledger: rpcTx.ledger,
    raw: rpcTx.raw,
  });

  /* =====================================================
     TRACE DEBUG (IMPORTANT FIX)
  ===================================================== */

  log("RPC_TRACE", {
    rpcReachable: rpcTx.rpcReachable,
    confirmed: rpcTx.confirmed,
    amountFound: rpcTx.amount !== null,
    receiverFound: !!rpcTx.receiver,
    senderFound: !!rpcTx.sender,
  });

  /* =====================================================
     VALIDATION PIPELINE
  ===================================================== */

  let verified = true;
  let stage = "RPC_OK";
  let reason: string | null = null;

  if (!rpcTx.rpcReachable) {
    verified = false;
    stage = "RPC_UNREACHABLE";
    reason = "RPC_UNREACHABLE";
    warn(stage, reason);
  }

  if (verified && !rpcTx.confirmed) {
    verified = false;
    stage = "RPC_FAIL";
    reason = "TX_NOT_CONFIRMED";
    warn(stage, reason);
  }

  if (verified && rpcTx.amount === null) {
    verified = false;
    stage = "RPC_PARSE_FAIL";
    reason = "AMOUNT_NOT_FOUND";
    warn(stage, { reason, raw: rpcTx.raw });
  }

  if (
    verified &&
    rpcTx.amount !== null &&
    !sameAmount(rpcTx.amount, expectedAmount)
  ) {
    verified = false;
    stage = "RPC_VALIDATION_FAIL";
    reason = "AMOUNT_MISMATCH";
    warn(stage, { rpc: rpcTx.amount, expected: expectedAmount });
  }

  if (verified && !rpcTx.receiver) {
    verified = false;
    stage = "RPC_PARSE_FAIL";
    reason = "RECEIVER_NOT_FOUND";
    warn(stage, reason);
  }

  if (
    verified &&
    rpcTx.receiver &&
    normalizeWallet(rpcTx.receiver) !== expectedReceiver
  ) {
    verified = false;
    stage = "RPC_VALIDATION_FAIL";
    reason = "RECEIVER_MISMATCH";
    warn(stage, {
      rpc: rpcTx.receiver,
      expected: expectedReceiver,
    });
  }

  /* =====================================================
     FINAL LOG
  ===================================================== */

  log("FINAL_RESULT", {
    verified,
    stage,
    reason,
    amount: rpcTx.amount,
    ledger: rpcTx.ledger,
  });

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
    txStatus: rpcTx.confirmed ? "confirmed" : "unconfirmed",
    chainReference: rpcTx.hash,
    payload: rpcTx.raw,
  });

  return {
    ok: verified,
    audited: true,
    verified,
    amount: rpcTx.amount,
    sender: rpcTx.sender,
    receiver: rpcTx.receiver,
    ledger: rpcTx.ledger,
    confirmed: rpcTx.confirmed,
    chainReference: rpcTx.hash,
    payload: rpcTx.raw,
    reason,
    stage,
  };
}
