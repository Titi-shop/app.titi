const PI_RPC_URL =
  process.env.PI_RPC_URL?.trim() ||
  "https://rpc.testnet.minepi.com";

/* =========================================================
   TYPES
========================================================= */

type RpcEnvelope = {
  jsonrpc?: string;
  id?: string | number;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
  };
};

export type ParsedRpcTransaction = {
  hash: string | null;
  status: string | null;
  ledger: number | null;

  amount: number | null;
  sender: string | null;
  receiver: string | null;

  raw: unknown;

  debug: {
    amountPath: string | null;
    senderPath: string | null;
    receiverPath: string | null;
  };
};

/* =========================================================
   HELPERS
========================================================= */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/* =========================================================
   RPC CALL
========================================================= */

async function rpcCall(
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(PI_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  const text = await res.text();

  let json: RpcEnvelope;

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("RPC_INVALID_JSON");
  }

  if (!res.ok) throw new Error("RPC_HTTP_ERROR");
  if (json.error) throw new Error(`RPC_ERROR_${json.error.code}`);

  return json.result;
}

/* =========================================================
   EXTRACTORS (CORE FIX)
========================================================= */

function extractAmount(tx: any): { value: number | null; path: string | null } {
  // 1. direct fields
  if (tx.amount != null) {
    return { value: toNum(tx.amount), path: "tx.amount" };
  }

  if (tx.value != null) {
    return { value: toNum(tx.value), path: "tx.value" };
  }

  // 2. operations style (Stellar-like)
  const ops =
    tx.operations ??
    tx.ops ??
    tx.tx?.operations ??
    [];

  if (Array.isArray(ops)) {
    for (const op of ops) {
      if (!isObject(op)) continue;

      const amount =
        toNum(op.amount ?? op.value ?? op.asset_amount);

      if (amount != null) {
        return { value: amount, path: "operations[].amount/value" };
      }
    }
  }

  // 3. fallback nested
  if (tx.transaction?.amount) {
    return { value: toNum(tx.transaction.amount), path: "transaction.amount" };
  }

  return { value: null, path: null };
}

function extractReceiver(tx: any): { value: string | null; path: string | null } {
  const direct =
    toStr(tx.receiver ?? tx.to ?? tx.destination);

  if (direct) return { value: direct, path: "tx.receiver/to/destination" };

  const ops =
    tx.operations ??
    tx.ops ??
    [];

  if (Array.isArray(ops)) {
    for (const op of ops) {
      if (!isObject(op)) continue;

      const r =
        toStr(op.to ?? op.destination ?? op.receiver);

      if (r) {
        return { value: r, path: "operations[].to/destination" };
      }
    }
  }

  return { value: null, path: null };
}

function extractSender(tx: any): { value: string | null; path: string | null } {
  const sender =
    toStr(tx.sender ?? tx.from ?? tx.source_account);

  if (sender) {
    return { value: sender, path: "tx.sender/from/source_account" };
  }

  return { value: null, path: null };
}

/* =========================================================
   MAIN FUNCTION
========================================================= */

export async function getRpcTransaction(
  txid: string
): Promise<ParsedRpcTransaction> {
  const cleanTx = txid.trim();

  console.log("[RPC V2] FETCH_START", { txid: cleanTx });

  const result: any = await rpcCall("getTransaction", {
    hash: cleanTx,
  });

  const tx =
    result.transaction ??
    result.tx ??
    result ??
    {};

  /* =====================================================
     EXTRACTION
  ===================================================== */

  const amount = extractAmount(tx);
  const receiver = extractReceiver(tx);
  const sender = extractSender(tx);

  const status =
    tx.successful === true
      ? "confirmed"
      : tx.status || "pending";

  const ledger =
    toNum(tx.ledger ?? tx.ledger_index);

  console.log("[RPC V2] PARSE_RESULT", {
    txid: cleanTx,
    amount,
    sender,
    receiver,
    ledger,
    status,
  });

  /* =====================================================
     RETURN
  ===================================================== */

  return {
    hash: toStr(tx.hash) || cleanTx,
    status,
    ledger,
    amount: amount.value,
    sender: sender.value,
    receiver: receiver.value,
    raw: result,

    debug: {
      amountPath: amount.path,
      senderPath: sender.path,
      receiverPath: receiver.path,
    },
  };
}
