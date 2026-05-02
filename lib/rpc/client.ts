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

  debug?: {
    amountFound: boolean;
    receiverFound: boolean;
    senderFound: boolean;
    opsCount: number;
  };
};

/* =========================================================
   LOGGER
========================================================= */

function log(tag: string, data?: unknown) {
  console.log(`[RPC CLIENT V3] ${tag}`, data ?? "");
}

function warn(tag: string, data?: unknown) {
  console.warn(`[RPC CLIENT V3] ${tag}`, data ?? "");
}

function err(tag: string, data?: unknown) {
  console.error(`[RPC CLIENT V3] ${tag}`, data ?? "");
}

/* =========================================================
   RPC CALL (LOW LEVEL)
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

  log("RPC_RAW_RESPONSE", rawText.slice(0, 500));

  let json: RpcEnvelope;

  try {
    json = JSON.parse(rawText);
  } catch (e) {
    err("RPC_INVALID_JSON", rawText);
    throw new Error("RPC_INVALID_JSON");
  }

  if (!res.ok) {
    err("RPC_HTTP_ERROR", { status: res.status, body: rawText });
    throw new Error(`RPC_HTTP_${res.status}`);
  }

  if (json.error) {
    err("RPC_ERROR", json.error);
    throw new Error(`RPC_ERROR_${json.error.code ?? "UNKNOWN"}`);
  }

  if (!json.result || typeof json.result !== "object") {
    err("RPC_EMPTY_RESULT", json);
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

  log("GET_TX_START", { txid: clean });

  if (!clean) {
    err("TXID_EMPTY");
    throw new Error("RPC_TXID_REQUIRED");
  }

  try {
    /* =====================================================
       FETCH
    ===================================================== */

    const result = await rpcCall("getTransaction", {
      hash: clean,
    });

    const tx = asObj(result.transaction ?? result);
    const ops = asArray(result.operations ?? tx.operations);

    log("PARSE_START", {
      opsCount: ops.length,
    });

    /* =====================================================
       INIT
    ===================================================== */

    let amount: number | null = null;
    let receiver: string | null = null;
    let sender: string | null = null;

    let amountFound = false;
    let receiverFound = false;
    let senderFound = false;

    /* =====================================================
       OPS SCAN (FORENSIC MODE)
    ===================================================== */

    for (let i = 0; i < ops.length; i++) {
      const op = asObj(ops[i]);

      const type = str(op.type);

      log("OP_SCAN", {
        index: i,
        type,
        op,
      });

      if (type && type !== "payment") continue;

      const opAmount = num(op.amount);
      const opReceiver = str(op.destination ?? op.to);
      const opSender = str(op.from ?? op.source);

      if (opAmount !== null) {
        amount = opAmount;
        amountFound = true;

        log("AMOUNT_FOUND", { amount, index: i });
      }

      if (opReceiver) {
        receiver = opReceiver;
        receiverFound = true;

        log("RECEIVER_FOUND", { receiver, index: i });
      }

      if (opSender) {
        sender = opSender;
        senderFound = true;

        log("SENDER_FOUND", { sender, index: i });
      }

      if (amount !== null && receiver !== null) break;
    }

    /* =====================================================
       FALLBACK FIELDS
    ===================================================== */

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

    const confirmed = ledger !== null || successful;

    /* =====================================================
       FINAL DEBUG LOG
    ===================================================== */

    log("PARSE_RESULT", {
      txid: clean,
      amount,
      sender,
      receiver,
      ledger,
      confirmed,
    });

    log("DEBUG_FLAGS", {
      amountFound,
      receiverFound,
      senderFound,
      opsCount: ops.length,
    });

    /* =====================================================
       RETURN
    ===================================================== */

    return {
      hash: str(tx.hash) || clean,
      ledger,
      amount,
      sender,
      receiver,
      confirmed,
      rpcReachable: true,
      raw: result,

      debug: {
        amountFound,
        receiverFound,
        senderFound,
        opsCount: ops.length,
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
        receiverFound: false,
        senderFound: false,
        opsCount: 0,
      },
    };
  }
}
