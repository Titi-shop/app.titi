/* =========================================================
   PI RPC CLIENT
   Centralized blockchain read interface
========================================================= */

const PI_RPC_URL =
  process.env.PI_RPC_URL?.trim() ||
  "https://rpc.testnet.minepi.com";

/* =========================================================
   BASE RPC TYPES
========================================================= */

type RpcEnvelope<T> = {
  jsonrpc?: string;
  id?: number | string;
  result?: T;
  error?: {
    code?: number;
    message?: string;
  };
};

export type RpcPaymentOperation = {
  type?: string;
  from?: string;
  to?: string;
  amount?: string;
  asset?: string;
};

export type RpcTransaction = {
  hash?: string;
  successful?: boolean;
  ledger?: number;
  created_at?: string;
  source_account?: string;
  fee_account?: string;
  memo?: string;
  operation_count?: number;
  operations?: RpcPaymentOperation[];
};

export type RpcHealth = {
  status?: string;
};

/* =========================================================
   LOW LEVEL CALL
========================================================= */

async function rpcCall<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  console.log("🟡 [RPC CLIENT] CALL", {
    method,
    params,
  });

  const res = await fetch(PI_RPC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  const raw = await res.text();

  let json: RpcEnvelope<T>;

  try {
    json = JSON.parse(raw) as RpcEnvelope<T>;
  } catch {
    console.error("🔥 [RPC CLIENT] INVALID_JSON", raw);
    throw new Error("RPC_INVALID_JSON");
  }

  if (!res.ok) {
    console.error("🔥 [RPC CLIENT] HTTP_FAIL", {
      status: res.status,
      body: raw,
    });
    throw new Error("RPC_HTTP_ERROR");
  }

  if (json.error) {
    console.error("🔥 [RPC CLIENT] RPC_FAIL", json.error);
    throw new Error(`RPC_ERROR_${json.error.code ?? "UNKNOWN"}`);
  }

  if (typeof json.result === "undefined") {
    console.error("🔥 [RPC CLIENT] EMPTY_RESULT");
    throw new Error("RPC_EMPTY_RESULT");
  }

  console.log("🟢 [RPC CLIENT] OK", {
    method,
  });

  return json.result;
}

/* =========================================================
   PUBLIC RPC METHODS
========================================================= */

export async function rpcHealthCheck(): Promise<RpcHealth> {
  return rpcCall<RpcHealth>("getHealth", {});
}

export async function rpcGetTransaction(
  txid: string
): Promise<RpcTransaction | null> {
  const clean = txid.trim();

  if (!clean) {
    throw new Error("RPC_TXID_REQUIRED");
  }

  try {
    return await rpcCall<RpcTransaction>("getTransaction", {
      hash: clean,
    });
  } catch (err) {
    console.warn("🟠 [RPC CLIENT] GET_TX_FAIL", err);
    return null;
  }
}

/* =========================================================
   EXTRACT PAYMENT DATA FROM TX
========================================================= */

export function extractPaymentOperation(
  tx: RpcTransaction | null
): {
  amount: number | null;
  receiver: string | null;
} {
  if (!tx?.operations || !Array.isArray(tx.operations)) {
    return {
      amount: null,
      receiver: null,
    };
  }

  for (const op of tx.operations) {
    const type = String(op.type || "").toLowerCase();

    if (type !== "payment") continue;

    const amount = Number(op.amount ?? 0);
    const receiver = String(op.to ?? "").trim();

    return {
      amount: Number.isFinite(amount) ? amount : null,
      receiver: receiver || null,
    };
  }

  return {
    amount: null,
    receiver: null,
  };
}
export { rpcGetTransaction as getRpcTransaction };
