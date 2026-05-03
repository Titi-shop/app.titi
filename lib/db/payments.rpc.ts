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
  txStatus: string | null;
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
   LOGGER
========================================================= */

function log(tag: string, data?: unknown) {
  console.log(`[RPC V6][${tag}]`, data ?? "");
}

function warn(tag: string, data?: unknown) {
  console.warn(`[RPC V6][${tag}]`, data ?? "");
}

function fail(tag: string, data?: unknown) {
  console.error(`[RPC V6][${tag}]`, data ?? "");
}

/* =========================================================
   SAFE HELPERS
========================================================= */

function isUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function normalizeWallet(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0000001;
}

/* =========================================================
   DB FETCH INTENT
========================================================= */

async function getPaymentIntent(
  paymentIntentId: string
): Promise<PaymentIntentRow | null> {
  log("DB_FETCH_INTENT_START", { paymentIntentId });

  const rs = await query<PaymentIntentRow>(
    `
    SELECT id, total_amount, merchant_wallet
    FROM payment_intents
    WHERE id = $1
    LIMIT 1
    `,
    [paymentIntentId]
  );

  const row = rs.rows[0] ?? null;

  log("DB_FETCH_INTENT_RESULT", row);

  return row;
}

/* =========================================================
   DB INSERT RPC LOG
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
    verified: input.verified,
    stage: input.stage,
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
   MAIN RPC VERIFY V6
========================================================= */

export async function verifyRpcPaymentForReconcile({
  paymentIntentId,
  txid,
}: VerifyRpcParams): Promise<RpcVerifyResult> {
  log("START", { paymentIntentId, txid });

  if (!isUUID(paymentIntentId) || !txid.trim()) {
    fail("INVALID_INPUT", { paymentIntentId, txid });
    throw new Error("INVALID_RPC_VERIFY_INPUT");
  }

  const intent = await getPaymentIntent(paymentIntentId);

  if (!intent) {
    fail("INTENT_NOT_FOUND", { paymentIntentId });
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

  const rpcTx = await getRpcTransaction(txid);

  log("RPC_RAW_RESULT", {
    confirmed: rpcTx.confirmed,
    amount: rpcTx.amount,
    sender: rpcTx.sender,
    receiver: rpcTx.receiver,
    ledger: rpcTx.ledger,
  });

  log("RPC_TRACE", {
    rpcReachable: rpcTx.rpcReachable,
    confirmed: rpcTx.confirmed,
    amountFound: rpcTx.debug.amountFound,
    senderFound: rpcTx.debug.senderFound,
    receiverFound: rpcTx.debug.receiverFound,
    parseLayer: rpcTx.debug.parseLayer,
    hasMeta: rpcTx.debug.hasMeta,
    hasEvents: rpcTx.debug.hasEvents,
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

  else if (!rpcTx.confirmed) {
    verified = false;
    stage = "RPC_NOT_CONFIRMED";
    reason = "TX_NOT_CONFIRMED";
    warn(stage, reason);
  }

  else if (rpcTx.amount === null) {
    verified = false;
    stage = "RPC_AMOUNT_UNREADABLE";
    reason = "AMOUNT_NOT_READABLE";
    warn(stage, {
      parseLayer: rpcTx.debug.parseLayer,
    });
  }

  else if (!sameAmount(rpcTx.amount, expectedAmount)) {
    verified = false;
    stage = "RPC_AMOUNT_MISMATCH";
    reason = "AMOUNT_MISMATCH";
    warn(stage, {
      rpc: rpcTx.amount,
      expected: expectedAmount,
    });
  }

  else if (!rpcTx.receiver) {
    verified = false;
    stage = "RPC_RECEIVER_UNREADABLE";
    reason = "RECEIVER_NOT_READABLE";
    warn(stage, {
      parseLayer: rpcTx.debug.parseLayer,
    });
  }

  else if (normalizeWallet(rpcTx.receiver) !== expectedReceiver) {
    verified = false;
    stage = "RPC_RECEIVER_MISMATCH";
    reason = "RECEIVER_MISMATCH";
    warn(stage, {
      rpc: rpcTx.receiver,
      expected: expectedReceiver,
    });
  }

  log("FINAL_RESULT", {
    verified,
    stage,
    reason,
    amount: rpcTx.amount,
    ledger: rpcTx.ledger,
    parseLayer: rpcTx.debug.parseLayer,
  });

  const txStatus = rpcTx.confirmed ? "confirmed" : "unconfirmed";

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
    txStatus,
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
    txStatus,
    chainReference: rpcTx.hash,

    payload: rpcTx.raw,
    reason,
    stage,
  };
}
