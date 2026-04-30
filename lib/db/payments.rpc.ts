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
   RPC CALL (RAW BLOCKCHAIN ONLY)
========================================================= */

async function rpcCall<T>(
  method: string,
  params: unknown
): Promise<T> {
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

  const text = await res.text();

  let json;

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("RPC_INVALID_JSON");
  }

  if (!res.ok) {
    throw new Error("RPC_HTTP_ERROR");
  }

  if (json?.error) {
    throw new Error("RPC_ERROR_" + json.error.code);
  }

  return json.result as T;
}

/* =========================================================
   AUDIT LOG (CLEAN)
========================================================= */

async function logRpc(params: {
  paymentIntentId: string;
  txid: string;
  verified: boolean;
  reason: string;
  stage: "RPC";
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
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (txid)
      DO UPDATE SET
        verified = EXCLUDED.verified,
        reason = EXCLUDED.reason,
        stage = EXCLUDED.stage,
        payload = EXCLUDED.payload
      `,
      [
        params.paymentIntentId,
        params.txid,
        params.verified,
        params.reason,
        params.stage,
        JSON.stringify(params.payload ?? {}),
      ]
    );
  } catch (e) {
    console.error("[RPC_LOG_FAIL]", e);
  }
}

/* =========================================================
   MAIN RPC V3
========================================================= */

export async function verifyRpcPaymentForReconcile({
  paymentIntentId,
  txid,
}: VerifyRpcParams) {
  console.log("🟡 [RPC_V3] START", {
    paymentIntentId,
    txid,
  });

  /* =========================================================
     IDEMPOTENCY CHECK
  ========================================================= */

  const existing = await query(
    `SELECT id FROM rpc_verification_logs WHERE txid = $1 LIMIT 1`,
    [txid]
  );

  if (existing.rows.length > 0) {
    console.log("🟢 [RPC_V3] ALREADY_DONE");

    return {
      ok: true,
      already: true,
    };
  }

  /* =========================================================
     FETCH TX
  ========================================================= */

  let tx: RpcTx | null = null;

  try {
    tx = await rpcCall<RpcTx>("getTransaction", {
      hash: txid,
    });
  } catch (err) {
    console.warn("[RPC_V3_TX_FAIL]", err);

    await logRpc({
      paymentIntentId,
      txid,
      verified: false,
      reason: "RPC_TX_FAIL",
      stage: "RPC",
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
      stage: "RPC",
      payload: null,
    });

    return {
      ok: true,
      skipped: true,
      reason: "TX_NULL",
    };
  }

  /* =========================================================
     AUDIT ONLY (NO BUSINESS LOGIC)
  ========================================================= */

  await logRpc({
    paymentIntentId,
    txid,
    verified: true,
    reason: "RPC_AUDIT_OK",
    stage: "RPC",
    payload: tx,
  });

  console.log("🟢 [RPC_V3] DONE");

  return {
    ok: true,
    ledger: tx.ledger ?? null,
    status: tx.status ?? "unknown",
    audited: true,
  };
}
