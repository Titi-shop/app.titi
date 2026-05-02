const PI_RPC_URL =
  process.env.PI_RPC_URL?.trim() ||
  "https://rpc.testnet.minepi.com";

/* =========================================================
   TYPES
========================================================= */

type RpcEnvelope = {
  jsonrpc?: string;
  id?: string | number;
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

  debug: {
    amountFound: boolean;
    senderFound: boolean;
    receiverFound: boolean;
    hasMeta: boolean;
    hasEvents: boolean;
  };
};

/* =========================================================
   LOGGER
========================================================= */

function log(tag: string, data?: unknown) {
  console.log(`[RPC CLIENT V3] ${tag}`, data ?? "");
}

function err(tag: string, data?: unknown) {
  console.error(`[RPC CLIENT V3] ${tag}`, data ?? "");
}

/* =========================================================
   RPC CALL
========================================================= */

async function rpcCall(
  method: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  log("RPC_CALL_START", { method, params });

  let res: Response;

  try {
    res = await fetch(PI_RPC_URL, {
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
  } catch (e) {
    err("RPC_NETWORK_FAIL", e);
    throw new Error("RPC_UNREACHABLE");
  }

  const rawText = await res.text();

  let json: RpcEnvelope;

  try {
    json = JSON.parse(rawText);
  } catch {
    err("RPC_INVALID_JSON", rawText);
    throw new Error("RPC_INVALID_JSON");
  }

  if (!res.ok) {
    err("RPC_HTTP_ERROR", { status: res.status });
    throw new Error(`RPC_HTTP_${res.status}`);
  }

  if (json.error) {
    err("RPC_ERROR", json.error);
    throw new Error("RPC_ERROR");
  }

  if (!json.result) {
    err("RPC_EMPTY_RESULT");
    throw new Error("RPC_EMPTY_RESULT");
  }

  log("RPC_CALL_OK");

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

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v.trim() : null;
}

/* =========================================================
   EXTRACT LOGIC (PI RPC SAFE MODE)
========================================================= */

function extractTx(tx: Record<string, unknown>) {
  const meta = tx.resultMetaXdr;
  const events = (tx as { events?: { transactionEventsXdr?: unknown[] } }).events
    ?.transactionEventsXdr;

  const amountRaw =
    tx.amount ??
    tx.value ??
    (tx as { payment?: { amount?: unknown } }).payment?.amount ??
    null;

  const sender =
    str(tx.from_address) ||
    str(tx.source_account) ||
    str(tx.source) ||
    null;

  const receiver =
    str(tx.to_address) ||
    str(tx.destination) ||
    (tx as { payment?: { destination?: string } }).payment?.destination ||
    null;

  return {
    amount: num(amountRaw),
    sender,
    receiver,
    hasMeta: !!meta,
    hasEvents: Array.isArray(events) && events.length > 0,
  };
}

/* =========================================================
   MAIN
========================================================= */

export async function getRpcTransaction(
  txid: string
): Promise<ParsedRpcTransaction> {
  const clean = txid.trim();

  log("GET_TX_START", { txid: clean });

  if (!clean) {
    throw new Error("RPC_TXID_REQUIRED");
  }

  try {
    const result = await rpcCall("getTransaction", {
      hash: clean,
    });

    const tx = asObj(result.transaction ?? result);

    const parsed = extractTx(tx);

    const ledger = num(tx.ledger);

    const confirmed =
      tx.status === "SUCCESS" ||
      (tx.successful === true) ||
      ledger !== null;

    const amountFound = parsed.amount !== null;
    const senderFound = parsed.sender !== null;
    const receiverFound = parsed.receiver !== null;

    log("PARSE_RESULT", {
      txid: clean,
      amount: parsed.amount,
      sender: parsed.sender,
      receiver: parsed.receiver,
      ledger,
      confirmed,
    });

    log("DEBUG", {
      amountFound,
      senderFound,
      receiverFound,
      hasMeta: parsed.hasMeta,
      hasEvents: parsed.hasEvents,
    });

    return {
      hash: str(tx.hash) || clean,
      ledger,
      amount: parsed.amount,
      sender: parsed.sender,
      receiver: parsed.receiver,
      confirmed,
      rpcReachable: true,
      raw: result,
      debug: {
        amountFound,
        senderFound,
        receiverFound,
        hasMeta: parsed.hasMeta,
        hasEvents: parsed.hasEvents,
      },
    };
  } catch (e) {
    err("GET_TX_FAIL", e);

    return {
      hash: clean,
      ledger: null,
      amount: null,
      sender: null,
      receiver: null,
      confirmed: false,
      rpcReachable: false,
      raw: {},
      debug: {
        amountFound: false,
        senderFound: false,
        receiverFound: false,
        hasMeta: false,
        hasEvents: false,
      },
    };
  }
}
