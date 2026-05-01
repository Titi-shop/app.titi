/* =========================================================
   PI RPC CLIENT (PRODUCTION FIXED)
   Centralized blockchain read interface
========================================================= */

const PI_RPC_URL =
  process.env.PI_RPC_URL?.trim() ||
  "https://rpc.testnet.minepi.com";

/* =========================================================
   BASE TYPES
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
  from?: string;
  to?: string;
  amount?: string | number;
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
   LOW LEVEL RPC CALL
========================================================= */

async function rpcCall<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
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
    json = JSON.parse(raw);
  } catch {
    throw new Error("RPC_INVALID_JSON");
  }

  if (!res.ok) {
    throw new Error("RPC_HTTP_ERROR");
  }

  if (json.error) {
    throw new Error(`RPC_ERROR_${json.error.code ?? "UNKNOWN"}`);
  }

  if (!json.result) {
    throw new Error("RPC_EMPTY_RESULT");
  }

  return json.result;
}

/* =========================================================
   PUBLIC METHODS
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
  } catch {
    return null;
  }
}

/* =========================================================
   SAFE PAYMENT EXTRACTOR (FIXED CORE BUG)
========================================================= */

export function extractPaymentOperation(
  tx: RpcTransaction | null
): {
  amount: number | null;
  receiver: string | null;
  sender: string | null;
} {
  if (!tx) {
    return { amount: null, receiver: null, sender: null };
  }

  // fallback: sometimes RPC puts sender here
  const sender = tx.source_account ?? null;

  const ops = Array.isArray(tx.operations) ? tx.operations : [];

  for (const op of ops) {
    const hasValue = op?.to && op?.amount;

    if (!hasValue) continue;

    const amount =
      typeof op.amount === "string"
        ? Number(op.amount)
        : typeof op.amount === "number"
          ? op.amount
          : null;

    return {
      amount: Number.isFinite(amount as number) ? (amount as number) : null,
      receiver: typeof op.to === "string" ? op.to : null,
      sender,
    };
  }

  return {
    amount: null,
    receiver: null,
    sender,
  };
}

/* =========================================================
   CONFIRMATION HELPERS
========================================================= */

export function isTransactionConfirmed(tx: RpcTransaction | null): boolean {
  if (!tx) return false;

  // Ledger existence is strongest proof in RPC systems
  if (typeof tx.ledger === "number") return true;

  // fallback (some networks)
  if (tx.successful === true) return true;

  return false;
}

/* =========================================================
   EXPORT ALIAS (BACKWARD COMPAT)
========================================================= */

export { rpcGetTransaction as getRpcTransaction };
