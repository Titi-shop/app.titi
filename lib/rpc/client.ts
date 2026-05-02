const PI_RPC_URL =
  process.env.PI_RPC_URL?.trim() ||
  "https://rpc.testnet.minepi.com";

/* =========================================================
   TYPES
========================================================= */

type RpcEnvelope = {
  jsonrpc?: string;
  id?: number | string;
  result?: Record<string, unknown>;
  error?: {
    code?: number;
    message?: string;
  };
};

export type ParsedRpcTransaction = {
  hash: string | null;
  ledger: number | null;
  amount: number | null;
  sender: string | null;
  receiver: string | null;
  confirmed: boolean;
  rpcReachable: boolean;
  raw: unknown;
};

/* =========================================================
   LOW LEVEL RPC CALL
========================================================= */

async function rpcCall(
  method: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
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

  const rawText = await res.text();

  let json: RpcEnvelope;

  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error("RPC_INVALID_JSON");
  }

  if (!res.ok) {
    throw new Error(`RPC_HTTP_${res.status}`);
  }

  if (json.error) {
    throw new Error(`RPC_ERROR_${json.error.code ?? "UNKNOWN"}`);
  }

  if (!json.result || typeof json.result !== "object") {
    throw new Error("RPC_EMPTY_RESULT");
  }

  return json.result;
}

/* =========================================================
   SAFE HELPERS
========================================================= */

function asObj(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null
    ? (v as Record<string, unknown>)
    : {};
}

function asArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v)
    ? (v as Record<string, unknown>[])
    : [];
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v.trim() : null;
}

/* =========================================================
   MAIN RPC PARSER
========================================================= */

export async function getRpcTransaction(
  txid: string
): Promise<ParsedRpcTransaction> {
  const clean = txid.trim();

  if (!clean) {
    throw new Error("RPC_TXID_REQUIRED");
  }

  try {
    const result = await rpcCall("getTransaction", {
      hash: clean,
    });

    const tx = asObj(result.transaction ?? result);
    const ops = asArray(result.operations ?? tx.operations);

    let amount: number | null = null;
    let receiver: string | null = null;
    let sender: string | null = null;

    for (const op of ops) {
      const opType = str(op.type);

      if (opType && opType !== "payment") {
        continue;
      }

      const opAmount = num(op.amount);

      const opReceiver =
        str(op.destination) ||
        str(op.to);

      const opSender =
        str(op.from) ||
        str(op.source);

      if (opAmount !== null) {
        amount = opAmount;
      }

      if (opReceiver) {
        receiver = opReceiver;
      }

      if (opSender) {
        sender = opSender;
      }

      if (amount !== null && receiver !== null) {
        break;
      }
    }

    sender =
      sender ||
      str(tx.source_account) ||
      str(tx.source) ||
      str(tx.fee_account) ||
      null;

    const ledger = num(tx.ledger);

    const successful =
      tx.successful === true ||
      String(tx.successful || "").toLowerCase() === "true";

    const confirmed =
      ledger !== null || successful === true;

    return {
      hash: str(tx.hash) || clean,
      ledger,
      amount,
      sender,
      receiver,
      confirmed,
      rpcReachable: true,
      raw: result,
    };
  } catch (err) {
    console.error("[RPC CLIENT] GET_TX_FAIL", err);

    return {
      hash: clean,
      ledger: null,
      amount: null,
      sender: null,
      receiver: null,
      confirmed: false,
      rpcReachable: false,
      raw: {},
    };
  }
}
