import { query } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

type VerifyRpcParams = {
  paymentIntentId: string;
  txid: string;
};

type RpcTx = {
  txid?: string;
  ledger?: number;
  status?: string;
};

/* =========================================================
   CONFIG
========================================================= */

const PI_RPC =
  process.env.PI_RPC_URL ?? "https://rpc.testnet.minepi.com";

/* =========================================================
   RPC CALL (RAW CHAIN ONLY)
========================================================= */

async function rpcCall<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(PI_RPC, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json) {
    throw new Error("RPC_HTTP_ERROR");
  }

  if (json.error) {
    throw new Error("RPC_ERROR_" + json.error.code);
  }

  return json.result as T;
}

/* =========================================================
   LOG (CLEAN AUDIT ONLY)
========================================================= */

async function logRpc(params: {
  paymentIntentId: string;
  txid: string;
  verified: boolean;
  reason: string;
  payload?: unknown;
}) {
  try {
    await query(
      `
      INSERT INTO rpc_verification_logs (
        payment_intent_id,
        txid,
        verified,
        reason,
        stage,
        payload
      )
      VALUES ($1,$2,$3,$4,'RPC',$5)
      ON CONFLICT (txid)
      DO UPDATE SET
        verified = EXCLUDED.verified,
        reason = EXCLUDED.reason,
        payload = EXCLUDED.payload
      `,
      [
        params.paymentIntentId,
        params.txid,
        params.verified,
        params.reason,
        JSON.stringify(params.payload ?? {}),
      ]
    );
  } catch (e) {
    console.error("[RPC_LOG_FAIL]", e);
  }
}

/* =========================================================
   RPC V4 CLEAN
========================================================= */

export async function verifyRpcPaymentForReconcile({
  paymentIntentId,
  txid,
}: VerifyRpcParams) {
  console.log("🟡 [RPC_V4] START", { paymentIntentId, txid });

  /* =========================================================
     IDEMPOTENCY
  ========================================================= */

  const existing = await query(
    `SELECT 1 FROM rpc_verification_logs WHERE txid = $1 LIMIT 1`,
    [txid]
  );

  if (existing.rows.length) {
    console.log("🟢 [RPC_V4] ALREADY_DONE");
    return { ok: true, already: true };
  }

  /* =========================================================
     FETCH TX
  ========================================================= */

  let tx: RpcTx;

  try {
    tx = await rpcCall<RpcTx>("getTransaction", { hash: txid });
  } catch (err) {
    await logRpc({
      paymentIntentId,
      txid,
      verified: false,
      reason: "RPC_TX_FAIL",
      payload: err,
    });

    return {
      ok: true,
      skipped: true,
      reason: "RPC_TX_UNAVAILABLE",
    };
  }

  if (!tx) {
    await logRpc({
      paymentIntentId,
      txid,
      verified: false,
      reason: "TX_NULL",
      payload: null,
    });

    return {
      ok: true,
      skipped: true,
      reason: "TX_NULL",
    };
  }

  /* =========================================================
     IMPORTANT: NO amount / receiver CHECK HERE
  ========================================================= */

  await logRpc({
    paymentIntentId,
    txid,
    verified: true,
    reason: "RPC_OK",
    payload: {
      txid: tx.txid,
      ledger: tx.ledger,
      status: tx.status,
    },
  });

  console.log("🟢 [RPC_V4] DONE");

  return {
    ok: true,
    ledger: tx.ledger ?? null,
    status: tx.status ?? "unknown",
  };
}
