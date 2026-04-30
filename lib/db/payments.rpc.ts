import { query } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

type VerifyRpcParams = {
  paymentIntentId: string;
  txid: string;
};

type RpcResponse<T> = {
  jsonrpc?: string;
  id?: number | string;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
};

type RpcTx = {
  hash?: string;
  txid?: string;
  successful?: boolean;
  status?: string;
  ledger?: number;

  /* Pi Network extension fields (may exist depending RPC version) */
  amount?: number;
  from_address?: string;
  to_address?: string;
};

/* =========================================================
   CONFIG
========================================================= */

const PI_RPC =
  process.env.PI_RPC_URL ?? "https://rpc.testnet.minepi.com";

/* =========================================================
   SAFE RPC CALL
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

  let json: RpcResponse<T>;

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("RPC_INVALID_JSON");
  }

  if (!res.ok) {
    throw new Error("RPC_HTTP_ERROR");
  }

  if (json?.error) {
    throw new Error(`RPC_ERROR_${json.error.code}`);
  }

  return json.result as T;
}

/* =========================================================
   LOG RPC (CLEAN + NO NULL NOISE)
========================================================= */

async function logRpc(params: {
  paymentIntentId: string;
  txid: string;
  verified: boolean;
  reason: string;
  stage: "FETCH" | "VERIFY" | "PARSE" | "FINALIZE" | "ERROR";
  amount?: number;
  receiver?: string;
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
        amount,
        receiver,
        payload
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (txid)
      DO UPDATE SET
        verified = EXCLUDED.verified,
        reason = EXCLUDED.reason,
        stage = EXCLUDED.stage,
        amount = EXCLUDED.amount,
        receiver = EXCLUDED.receiver,
        payload = EXCLUDED.payload
      `,
      [
        params.paymentIntentId,
        params.txid,
        params.verified,
        params.reason,
        params.stage,
        params.amount ?? null,
        params.receiver ?? null,
        JSON.stringify(params.payload ?? {}),
      ]
    );
  } catch (e) {
    console.error("[RPC_LOG_FAIL]", e);
  }
}

/* =========================================================
   NORMALIZE TX (🔥 IMPORTANT FIX)
========================================================= */

function normalizeTx(tx: RpcTx) {
  return {
    txid: tx.txid ?? tx.hash ?? null,
    ledger: tx.ledger ?? null,
    status: tx.status ?? "unknown",
    successful: tx.successful ?? false,

    // Pi optional fields
    amount: typeof tx.amount === "number" ? tx.amount : null,
    receiver: tx.to_address ?? null,
    sender: tx.from_address ?? null,
  };
}

/* =========================================================
   MAIN FUNCTION (RPC V2)
========================================================= */

export async function verifyRpcPaymentForReconcile({
  paymentIntentId,
  txid,
}: VerifyRpcParams) {
  console.log("🟡 [RPC_V2] START", {
    paymentIntentId,
    txid,
  });

  /* =========================================================
     STEP 0: IDEMPOTENCY CHECK
  ========================================================= */

  const receipt = await query(
    `SELECT id FROM payment_receipts WHERE txid = $1 LIMIT 1`,
    [txid]
  );

  if (receipt.rows.length > 0) {
    console.log("🟢 [RPC_V2] ALREADY_DONE");

    return {
      ok: true,
      already: true,
    };
  }

  /* =========================================================
     STEP 1: FETCH RPC TX
  ========================================================= */

  let tx: RpcTx;

  try {
    tx = await rpcCall<RpcTx>("getTransaction", {
      hash: txid,
    });
  } catch (err) {
    await logRpc({
      paymentIntentId,
      txid,
      verified: false,
      reason: "RPC_FETCH_FAILED",
      stage: "FETCH",
      payload: err,
    });

    return {
      ok: true,
      skipped: true,
      reason: "RPC_UNAVAILABLE",
    };
  }

  if (!tx) {
    await logRpc({
      paymentIntentId,
      txid,
      verified: false,
      reason: "TX_NULL",
      stage: "FETCH",
    });

    return {
      ok: true,
      skipped: true,
      reason: "TX_NULL",
    };
  }

  /* =========================================================
     STEP 2: NORMALIZE + VALIDATE
  ========================================================= */

  const normalized = normalizeTx(tx);

  await logRpc({
    paymentIntentId,
    txid,
    verified: true,
    reason: "RPC_FETCH_OK",
    stage: "VERIFY",
    payload: normalized,
  });

  /* =========================================================
     STEP 3: PARSE CRITICAL DATA (FIX YOUR NULL ISSUE)
  ========================================================= */

  const amount = normalized.amount;
  const receiver = normalized.receiver;

  if (!amount || !receiver) {
    await logRpc({
      paymentIntentId,
      txid,
      verified: false,
      reason: "RPC_MISSING_FIELDS",
      stage: "PARSE",
      payload: normalized,
    });

    console.warn("⚠️ [RPC_V2] MISSING_FIELDS", {
      amount,
      receiver,
    });

    return {
      ok: true,
      skipped: true,
      reason: "INCOMPLETE_TX",
    };
  }

  /* =========================================================
     STEP 4: FINAL AUDIT OK
  ========================================================= */

  await logRpc({
    paymentIntentId,
    txid,
    verified: true,
    reason: "RPC_AUDIT_OK",
    stage: "FINALIZE",
    amount,
    receiver,
    payload: normalized,
  });

  console.log("🟢 [RPC_V2] DONE", {
    amount,
    receiver,
  });

  return {
    ok: true,
    ledger: normalized.ledger,
    status: normalized.status,
    amount,
    receiver,
    audited: true,
  };
}
