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
};

type RpcOps = {
  type?: string;
  type_i?: number;
  to?: string;
  destination?: string;
  amount?: string | number;
};

/* =========================================================
   CONFIG
========================================================= */

const PI_RPC =
  process.env.PI_RPC_URL ?? "https://rpc.testnet.minepi.com";

/* =========================================================
   SAFE RPC CALL (PI STANDARD JSON-RPC)
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

  console.log("[RPC_RAW]", text);

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
    throw new Error("RPC_ERROR_" + json.error.code);
  }

  return json.result as T;
}

/* =========================================================
   HELPERS
========================================================= */

function toNumber(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("INVALID_NUMBER");
  return n;
}

/* =========================================================
   LOG RPC (AUDIT ONLY)
========================================================= */

async function logRpc(params: {
  paymentIntentId: string;
  txid: string;
  verified: boolean;
  reason: string;
  stage: "VERIFY" | "FINALIZE" | "PI" | "RPC";
  amount?: number | null;
  receiver?: string | null;
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
   MAIN FUNCTION (SAFE AUDIT LAYER)
========================================================= */

export async function verifyRpcPaymentForReconcile({
  paymentIntentId,
  txid,
}: VerifyRpcParams) {
  console.log("🟡 [RPC_VERIFY] START", {
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
    console.log("🟢 [RPC_VERIFY] ALREADY_DONE");
    return {
      ok: true,
      already: true,
    };
  }

  /* =========================================================
     STEP 1: FETCH TX (NON-BLOCKING)
  ========================================================= */

  let tx: RpcTx | null = null;

  try {
    tx = await rpcCall<RpcTx>("getTransaction", {
      hash: txid,
    });
  } catch (err) {
    console.warn("[RPC_TX_FAIL]", err);

    await logRpc(
      paymentIntentId,
      txid,
      false,
      "RPC_TX_FAIL",
      err
    );

    return {
      ok: true,
      skipped: true,
      reason: "RPC_TX_UNAVAILABLE",
    };
  }

  if (!tx) {
    await logRpc(
      paymentIntentId,
      txid,
      false,
      "TX_NULL",
      tx
    );

    return {
      ok: true,
      skipped: true,
      reason: "TX_NULL",
    };
  }

  /* =========================================================
     STEP 2: FETCH OPS (OPTIONAL)
  ========================================================= */

  let rpcVerified: {
  ok: boolean;
  txid?: string;
  ledger?: number | null;
  status?: string;
  skipped?: boolean;
  reason?: string;
} | null = null;

try {
  console.log("🟡 [RPC_VERIFY] getTransaction", txid);

  const tx = await rpcCall<{
    ledger?: number;
    status?: string;
    successful?: boolean;
  }>("getTransaction", {
    hash: txid,
  });

  rpcVerified = {
    ok: true,
    txid,
    ledger: tx?.ledger ?? null,
    status: tx?.status ?? "unknown",
  };

  console.log("🟢 [RPC_VERIFY] OK", rpcVerified);
} catch (err) {
  console.warn("⚠️ [RPC_VERIFY] FAILED (NON-BLOCKING)", err);

  rpcVerified = {
    ok: true, // 🔥 QUAN TRỌNG: không fail flow
    skipped: true,
    reason: "RPC_UNAVAILABLE",
  };
}
  /* =========================================================
     STEP 3: FIND PAYMENT OP (FLEXIBLE)
  ========================================================= */

  const paymentOp = ops.find((o) => {
    return (
      o.amount !== undefined &&
      (o.to || o.destination)
    );
  });

  if (!paymentOp) {
    await logRpc(
      paymentIntentId,
      txid,
      false,
      "NO_PAYMENT_OP",
      ops
    );

    return {
      ok: true,
      skipped: true,
      reason: "NO_PAYMENT_OP",
    };
  }

  /* =========================================================
     STEP 4: NORMALIZE DATA
  ========================================================= */

  const rpcReceiver = String(
    paymentOp.to || paymentOp.destination || ""
  ).trim();

  const rpcAmount = toNumber(paymentOp.amount ?? 0);

  /* =========================================================
     STEP 5: FINAL AUDIT CHECK (NON-BLOCKING)
  ========================================================= */

  await logRpc(
    paymentIntentId,
    txid,
    true,
    "RPC_AUDIT_OK",
    {
      tx,
      paymentOp,
    }
  );

  console.log("🟢 [RPC_VERIFY] DONE (NON_BLOCKING)");

  return {
    ok: true,
    amount: rpcAmount,
    receiver: rpcReceiver,
    ledger: tx.ledger ?? null,
    audited: true,
  };
}
