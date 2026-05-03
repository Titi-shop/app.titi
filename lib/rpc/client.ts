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

type RpcEventsContainer = {
  transactionEventsXdr?: unknown[];
  contractEventsXdr?: unknown[];
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
  console.log(`[RPC CLIENT V4] ${tag}`, data ?? "");
}

function error(tag: string, data?: unknown) {
  console.error(`[RPC CLIENT V4] ${tag}`, data ?? "");
}

/* =========================================================
   RPC CALL
========================================================= */

async function rpcCall(
  method: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  log("RPC_CALL_START", { method, params });

  let response: Response;

  try {
    response = await fetch(PI_RPC_URL, {
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
    error("RPC_NETWORK_FAIL", e);
    throw new Error("RPC_UNREACHABLE");
  }

  const text = await response.text();

  let json: RpcEnvelope;

  try {
    json = JSON.parse(text) as RpcEnvelope;
  } catch {
    error("RPC_INVALID_JSON", text);
    throw new Error("RPC_INVALID_JSON");
  }

  if (!response.ok) {
    error("RPC_HTTP_ERROR", { status: response.status });
    throw new Error(`RPC_HTTP_${response.status}`);
  }

  if (json.error) {
    error("RPC_ERROR", json.error);
    throw new Error("RPC_ERROR");
  }

  if (!json.result) {
    error("RPC_EMPTY_RESULT");
    throw new Error("RPC_EMPTY_RESULT");
  }

  log("RPC_CALL_OK");

  return json.result;
}

/* =========================================================
   SAFE CAST
========================================================= */

function asObj(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/* =========================================================
   PI AMOUNT NORMALIZER
   Pi RPC often returns atomic integer like 11000000 => 1.1 PI
========================================================= */

function normalizePiAmount(value: unknown): number | null {
  const raw = num(value);

  if (raw === null) {
    return null;
  }

  if (raw <= 0) {
    return null;
  }

  if (raw >= 10000000) {
    return raw / 10000000;
  }

  return raw;
}

/* =========================================================
   EXTRACTOR
========================================================= */

function extractTxFields(
  tx: Record<string, unknown>
): {
  amount: number | null;
  sender: string | null;
  receiver: string | null;
  hasMeta: boolean;
  hasEvents: boolean;
} {
  const events = asObj(tx.events) as RpcEventsContainer;

  const hasMeta = typeof tx.resultMetaXdr === "string";
  const hasEvents =
    (Array.isArray(events.transactionEventsXdr) &&
      events.transactionEventsXdr.length > 0) ||
    (Array.isArray(events.contractEventsXdr) &&
      events.contractEventsXdr.length > 0);

  /* =====================================================
     AMOUNT PARSE
     priority: amount -> value -> payment.amount
  ===================================================== */

  const amount =
    normalizePiAmount(tx.amount) ??
    normalizePiAmount(tx.value) ??
    normalizePiAmount(asObj(tx.payment).amount);

  /* =====================================================
     SENDER PARSE
  ===================================================== */

  const sender =
    str(tx.from_address) ||
    str(tx.source_account) ||
    str(tx.source) ||
    str(tx.account);

  /* =====================================================
     RECEIVER PARSE
     Pi RPC often does not expose this directly
     so null is honest, not fake parse
  ===================================================== */

  const receiver =
    str(tx.to_address) ||
    str(tx.destination) ||
    str(asObj(tx.payment).destination);

  return {
    amount,
    sender: sender ?? null,
    receiver: receiver ?? null,
    hasMeta,
    hasEvents,
  };
}

/* =========================================================
   MAIN
========================================================= */

export async function getRpcTransaction(
  txid: string
): Promise<ParsedRpcTransaction> {
  const cleanTxid = txid.trim();

  log("GET_TX_START", { txid: cleanTxid });

  if (!cleanTxid) {
    throw new Error("RPC_TXID_REQUIRED");
  }

  try {
    const result = await rpcCall("getTransaction", {
      hash: cleanTxid,
    });

    const tx = asObj(result.transaction ?? result);

    const extracted = extractTxFields(tx);

    const ledger = num(tx.ledger);

    const confirmed =
      tx.status === "SUCCESS" ||
      tx.successful === true ||
      ledger !== null;

    const amountFound = extracted.amount !== null;
    const senderFound = extracted.sender !== null;
    const receiverFound = extracted.receiver !== null;

    log("PARSE_RESULT", {
      txid: cleanTxid,
      amount: extracted.amount,
      sender: extracted.sender,
      receiver: extracted.receiver,
      ledger,
      confirmed,
    });

    log("DEBUG", {
      amountFound,
      senderFound,
      receiverFound,
      hasMeta: extracted.hasMeta,
      hasEvents: extracted.hasEvents,
    });

    return {
      hash: str(tx.hash) || cleanTxid,
      ledger,
      amount: extracted.amount,
      sender: extracted.sender,
      receiver: extracted.receiver,
      confirmed,
      rpcReachable: true,
      raw: result,
      debug: {
        amountFound,
        senderFound,
        receiverFound,
        hasMeta: extracted.hasMeta,
        hasEvents: extracted.hasEvents,
      },
    };
  } catch (e) {
    error("GET_TX_FAIL", e);

    return {
      hash: cleanTxid,
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
