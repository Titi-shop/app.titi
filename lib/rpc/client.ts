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

type JsonObj = Record<string, unknown>;

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
    parseLayer: string;
    hasMeta: boolean;
    hasEvents: boolean;
  };
};

/* =========================================================
   LOG
========================================================= */

function log(tag: string, data?: unknown) {
  console.log(`[RPC CLIENT V6] ${tag}`, data ?? "");
}

function err(tag: string, data?: unknown) {
  console.error(`[RPC CLIENT V6] ${tag}`, data ?? "");
}

/* =========================================================
   HELPERS
========================================================= */

function asObj(v: unknown): JsonObj {
  return typeof v === "object" && v !== null
    ? (v as JsonObj)
    : {};
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v.trim() : null;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function deepFindString(
  node: unknown,
  keys: string[]
): string | null {
  if (!node || typeof node !== "object") return null;

  const obj = node as JsonObj;

  for (const k of keys) {
    if (typeof obj[k] === "string") {
      const val = String(obj[k]).trim();
      if (val) return val;
    }
  }

  for (const v of Object.values(obj)) {
    const found = deepFindString(v, keys);
    if (found) return found;
  }

  return null;
}

function deepFindNumber(
  node: unknown,
  keys: string[]
): number | null {
  if (!node || typeof node !== "object") return null;

  const obj = node as JsonObj;

  for (const k of keys) {
    const n = num(obj[k]);
    if (n !== null) return n;
  }

  for (const v of Object.values(obj)) {
    const found = deepFindNumber(v, keys);
    if (found !== null) return found;
  }

  return null;
}

/* =========================================================
   RPC CALL
========================================================= */

async function rpcCall(
  method: string,
  params: Record<string, unknown>
): Promise<JsonObj> {
  log("RPC_CALL_START", { method, params });

  let res: Response;

  try {
    res = await fetch(PI_RPC_URL, {
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
    err("RPC_HTTP_FAIL", { status: res.status });
    throw new Error(`RPC_HTTP_${res.status}`);
  }

  if (json.error) {
    err("RPC_METHOD_FAIL", json.error);
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
   LAYER A — PARSE JSON UNPACKED ENVELOPE
========================================================= */

function parseFromEnvelopeJson(result: JsonObj) {
  const tx = asObj(result);

  const sender =
    deepFindString(tx, [
      "sourceAccount",
      "source_account",
      "from",
      "from_address",
    ]) || null;

  const receiver =
    deepFindString(tx, [
      "destination",
      "to",
      "to_address",
      "toAccount",
    ]) || null;

  let amount =
    deepFindNumber(tx, [
      "amount",
      "sendAmount",
      "value",
    ]);

  if (amount !== null && amount > 10000000) {
    amount = amount / 10000000;
  }

  return { amount, sender, receiver };
}

/* =========================================================
   LAYER B — PARSE EVENTS
========================================================= */

function parseFromEvents(result: JsonObj) {
  const events = asObj(result.events);
  const txEvents = asArr(events.transactionEventsXdr);
  const contractEvents = asArr(events.contractEventsXdr);

  const sender =
    deepFindString(txEvents, ["from", "source"]) ||
    deepFindString(contractEvents, ["from", "source"]);

  const receiver =
    deepFindString(txEvents, ["to", "destination"]) ||
    deepFindString(contractEvents, ["to", "destination"]);

  let amount =
    deepFindNumber(txEvents, ["amount", "value"]) ??
    deepFindNumber(contractEvents, ["amount", "value"]);

  if (amount !== null && amount > 10000000) {
    amount = amount / 10000000;
  }

  return { amount, sender, receiver };
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
      xdrFormat: "json",
    });

    const ledger = num(result.ledger);
    const status = str(result.status);

    const confirmed =
      status === "SUCCESS" ||
      status === "FAILED" ||
      ledger !== null;

    let amount: number | null = null;
    let sender: string | null = null;
    let receiver: string | null = null;
    let parseLayer = "NONE";

    /* ===== layer A ===== */

    const a = parseFromEnvelopeJson(result);

    if (a.amount !== null || a.sender || a.receiver) {
      amount = a.amount;
      sender = a.sender;
      receiver = a.receiver;
      parseLayer = "ENVELOPE_JSON";
    }

    /* ===== layer B fallback ===== */

    if (amount === null && !sender && !receiver) {
      const b = parseFromEvents(result);

      if (b.amount !== null || b.sender || b.receiver) {
        amount = b.amount;
        sender = b.sender;
        receiver = b.receiver;
        parseLayer = "EVENTS";
      }
    }

    log("PARSE_RESULT", {
      txid: clean,
      amount,
      sender,
      receiver,
      ledger,
      confirmed,
      parseLayer,
    });

    return {
      hash: str(result.txHash) || clean,
      ledger,
      amount,
      sender,
      receiver,
      confirmed,
      rpcReachable: true,
      raw: result,
      debug: {
        amountFound: amount !== null,
        senderFound: !!sender,
        receiverFound: !!receiver,
        parseLayer,
        hasMeta: !!result.resultMetaXdr,
        hasEvents: !!result.events,
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
        parseLayer: "FAIL",
        hasMeta: false,
        hasEvents: false,
      },
    };
  }
}
