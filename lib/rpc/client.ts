const PI_RPC_URL =
  process.env.PI_RPC_URL?.trim() ||
  "https://rpc.testnet.minepi.com";

/* =========================================================
   TYPES
========================================================= */

type RpcError = {
  code?: number;
  message?: string;
};

type RpcEnvelope = {
  jsonrpc?: string;
  id?: string | number;
  result?: unknown;
  error?: RpcError;
};

type RpcResult = {
  transaction?: unknown;
  ledger?: unknown;
  status?: unknown;
  hash?: unknown;
  successful?: unknown;
  source_account?: unknown;
};

export type ParsedRpcTransaction = {
  hash: string | null;
  ledger: number | null;
  confirmed: boolean;
  rpcReachable: boolean;
  raw: unknown;
};

/* =========================================================
   LOGGER
========================================================= */

function log(tag: string, data?: unknown) {
  console.log(`[RPC CLIENT V4] ${tag}`, data ?? "");
}

function err(tag: string, data?: unknown) {
  console.error(`[RPC CLIENT V4] ${tag}`, data ?? "");
}

/* =========================================================
   SAFE CAST HELPERS
========================================================= */

function asObject(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object"
    ? (v as Record<string, unknown>)
    : {};
}

function toString(v: unknown): string | null {
  return typeof v === "string" ? v.trim() : null;
}

function toNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* =========================================================
   RPC CALL
========================================================= */

async function rpcCall(
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
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

  const text = await res.text();

  let json: RpcEnvelope;

  try {
    json = JSON.parse(text) as RpcEnvelope;
  } catch {
    err("RPC_INVALID_JSON", text);
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

  log("RPC_CALL_OK");

  return json.result ?? {};
}

/* =========================================================
   MAIN RPC FUNCTION
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
    const result = (await rpcCall("getTransaction", {
      hash: clean,
    })) as RpcResult;

    const tx = asObject(result.transaction ?? result);

    /* =====================================================
       ONLY SAFE FIELDS FROM RPC
    ===================================================== */

    const hash = toString(tx.hash) ?? clean;
    const ledger = toNumber(tx.ledger);

    const status = toString(tx.status);
    const successful = tx.successful === true;

    const confirmed =
      status === "SUCCESS" ||
      successful ||
      ledger !== null;

    log("PARSE_RESULT", {
      hash,
      ledger,
      confirmed,
    });

    /* =====================================================
       RETURN CLEAN RESULT
    ===================================================== */

    return {
      hash,
      ledger,
      confirmed,
      rpcReachable: true,
      raw: result,
    };
  } catch (e) {
    err("GET_TX_FAIL", e);

    return {
      hash: clean,
      ledger: null,
      confirmed: false,
      rpcReachable: false,
      raw: {},
    };
  }
}
