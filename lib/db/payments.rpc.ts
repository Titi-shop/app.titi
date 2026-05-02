import { query } from "@/lib/db/index";
import { getRpcTransaction } from "@/lib/rpc/client";

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
};

type PaymentIntentRow = {
  id: string;
  total_amount: string;
  merchant_wallet: string | null;
};

type InsertRpcLogParams = {
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
};

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function normalizeWallet(v: string | null): string {
  return (v || "").trim().toLowerCase();
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0000001;
}

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

async function insertRpcVerificationLog(
  params: InsertRpcLogParams
): Promise<void> {
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
      params.paymentIntentId,
      params.txid,
      params.verified,
      params.stage,
      params.reason,
      params.amount,
      params.sender,
      params.receiver,
      params.ledger,
      params.txStatus,
      params.chainReference,
      JSON.stringify(params.payload ?? {}),
    ]
  );
}

export async function verifyRpcPaymentForReconcile({
  paymentIntentId,
  txid,
}: VerifyRpcParams): Promise<RpcVerifyResult> {
  if (!isUUID(paymentIntentId) || !txid.trim()) {
    throw new Error("INVALID_RPC_VERIFY_INPUT");
  }

  console.log("[PAYMENT][RPC] START", {
    paymentIntentId,
    txid,
  });

  const paymentIntent = await getPaymentIntent(paymentIntentId);

  if (!paymentIntent) {
    throw new Error("PAYMENT_INTENT_NOT_FOUND");
  }

  const expectedAmount = Number(paymentIntent.total_amount);
  const expectedReceiver = normalizeWallet(paymentIntent.merchant_wallet);

  const rpcTx = await getRpcTransaction(txid);

  let verified = true;
  let stage = "RPC_OK";
  let reason: string | null = null;

  if (!rpcTx.rpcReachable) {
    verified = false;
    stage = "RPC_FAIL";
    reason = "RPC_UNREACHABLE";
  }

  if (verified && !rpcTx.confirmed) {
    verified = false;
    stage = "RPC_FAIL";
    reason = "TX_NOT_CONFIRMED";
  }

  if (verified && rpcTx.amount === null) {
    verified = false;
    stage = "RPC_FAIL";
    reason = "AMOUNT_NOT_FOUND";
  }

  if (
    verified &&
    rpcTx.amount !== null &&
    !sameAmount(rpcTx.amount, expectedAmount)
  ) {
    verified = false;
    stage = "RPC_FAIL";
    reason = "AMOUNT_MISMATCH";
  }

  if (verified && !rpcTx.receiver) {
    verified = false;
    stage = "RPC_FAIL";
    reason = "RECEIVER_NOT_FOUND";
  }

  if (
    verified &&
    rpcTx.receiver &&
    normalizeWallet(rpcTx.receiver) !== expectedReceiver
  ) {
    verified = false;
    stage = "RPC_FAIL";
    reason = "RECEIVER_MISMATCH";
  }

  await insertRpcVerificationLog({
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

  console.log("[PAYMENT][RPC] DONE", {
    verified,
    reason,
    amount: rpcTx.amount,
    receiver: rpcTx.receiver,
    ledger: rpcTx.ledger,
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
  };
}
