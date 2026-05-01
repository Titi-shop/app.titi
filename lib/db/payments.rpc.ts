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
  txStatus: string | null;
  chainReference: string | null;
  payload: unknown;
  reason: string | null;
};

type PaymentIntentRow = {
  id: string;
  total_amount: string;
  merchant_wallet: string | null;
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

async function getPaymentIntent(paymentIntentId: string): Promise<PaymentIntentRow | null> {
  const sql = `
  SELECT
    id,
    total_amount,
    merchant_wallet
  FROM payment_intents
  WHERE id = $1
  LIMIT 1
`;

  const result = await query<PaymentIntentRow>(sql, [paymentIntentId]);
  return result.rows[0] || null;
}

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

async function insertRpcVerificationLog(params: InsertRpcLogParams): Promise<void> {
  const sql = `
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
  `;

  await query(sql, [
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
  ]);
}

export async function verifyRpcPaymentForReconcile({
  paymentIntentId,
  txid,
}: VerifyRpcParams): Promise<RpcVerifyResult> {
  if (!isUUID(paymentIntentId) || !txid.trim()) {
    throw new Error("INVALID_RPC_VERIFY_INPUT");
  }

  console.log("[PAYMENT][RPC] START", { paymentIntentId });

  const paymentIntent = await getPaymentIntent(paymentIntentId);

  if (!paymentIntent) {
    throw new Error("PAYMENT_INTENT_NOT_FOUND");
  }

  const expectedAmount = Number(paymentIntent.total_amount);
  const expectedReceiver = normalizeWallet(paymentIntent.merchant_wallet);

  const rpcTx = await getRpcTransaction(txid);

  const chainAmount = rpcTx.amount;
  const chainSender = rpcTx.sender;
  const chainReceiver = rpcTx.receiver;
  const chainLedger = rpcTx.ledger;
  const chainStatus = rpcTx.status;
  const chainReference = rpcTx.hash;

  let verified = true;
  let reason: string | null = null;
  let stage = "RPC_DONE";

  if (chainStatus !== "success" && chainStatus !== "confirmed") {
    verified = false;
    reason = "TX_NOT_CONFIRMED";
    stage = "RPC_FAIL";
  }

  if (verified && Number(chainAmount.toFixed(7)) !== Number(expectedAmount.toFixed(7))) {
    verified = false;
    reason = "AMOUNT_MISMATCH";
    stage = "RPC_FAIL";
  }

  if (verified && normalizeWallet(chainReceiver) !== expectedReceiver) {
    verified = false;
    reason = "RECEIVER_MISMATCH";
    stage = "RPC_FAIL";
  }

  await insertRpcVerificationLog({
    paymentIntentId,
    txid,
    verified,
    stage,
    reason,
    amount: chainAmount,
    sender: chainSender,
    receiver: chainReceiver,
    ledger: chainLedger,
    txStatus: chainStatus,
    chainReference,
    payload: rpcTx.raw,
  });

  console.log("[PAYMENT][RPC] AUDIT_WRITTEN", {
    verified,
    reason,
    amount: chainAmount,
  });

  return {
    ok: verified,
    audited: true,
    verified,
    amount: chainAmount,
    sender: chainSender,
    receiver: chainReceiver,
    ledger: chainLedger,
    txStatus: chainStatus,
    chainReference,
    payload: rpcTx.raw,
    reason,
  };
}
