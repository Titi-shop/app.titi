const PI_RPC_URL =
  process.env.PI_RPC_URL?.trim() ||
  "https://rpc.testnet.minepi.com";

/* =========================
   TYPES
========================= */

type Json = Record<string, unknown>;

export type ParsedRpcTransaction = {
  hash: string | null;
  ledger: number | null;

  amount: number | null;
  sender: string | null;
  receiver: string | null;

  memo: string | null;
  createdAt: string | null;

  confirmed: boolean;
  rpcReachable: boolean;

  raw: Json;

  debug: {
    amountFound: boolean;
    senderFound: boolean;
    receiverFound: boolean;
    parseLayer: "ENVELOPE" | "EVENTS" | "FAILED";
    hasMeta: boolean;
    hasEvents: boolean;
  };
};

/* =========================
   SAFE HELPERS
========================= */

const asObj = (v: unknown): Json =>
  v && typeof v === "object" ? (v as Json) : {};

const asArr = (v: unknown): unknown[] =>
  Array.isArray(v) ? v : [];

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* =========================
   DEEP FIND
========================= */

function deepFind(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;

  const o = obj as Json;

  for (const k of keys) {
    if (typeof o[k] === "string") return str(o[k]);
  }

  for (const v of Object.values(o)) {
    const found = deepFind(v, keys);
    if (found) return found;
  }

  return null;
}

/* =========================
   RPC CALL
========================= */

async function rpcCall(method: string, params: Json): Promise<Json> {
  const res = await fetch(PI_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  const json = (await res.json()) as {
    result?: Json;
    error?: unknown;
  };

  if (!res.ok || json.error || !json.result) {
    throw new Error("RPC_FAIL");
  }

  return json.result;
}

/* =========================
   PARSE ENVELOPE
========================= */

function parseEnvelope(result: Json) {
  const memo =
    deepFind(result, ["memo"]) ||
    deepFind(result, ["text"]);

  const sender =
    deepFind(result, ["source_account", "sender"]);

  const receiver =
    deepFind(result, ["destination", "receiver"]);

  let amount = num(
    deepFind(result, ["amount"])
  );

  if (amount && amount > 1e7) {
    amount = amount / 1e7;
  }

  return { amount, sender, receiver, memo };
}

/* =========================
   PARSE EVENTS (FIXED KEY)
========================= */

function parseEvents(result: Json) {
  const events = asObj(result.events);

  const contract = asArr(events.contractEventsJson);
  const tx = asArr(events.transactionEventsJson);

  const sender =
    deepFind(contract, ["address"]) ||
    deepFind(tx, ["address"]);

  const receiver =
    deepFind(contract, ["destination"]);

  let amount =
    num(deepFind(contract, ["amount"])) ||
    num(deepFind(tx, ["amount"]));

  if (amount && amount > 1e7) {
    amount = amount / 1e7;
  }

  return { amount, sender, receiver };
}

/* =========================
   MAIN
========================= */

export async function getRpcTransaction(
  txid: string
): Promise<ParsedRpcTransaction> {
  const clean = txid.trim();

  if (!clean) throw new Error("TXID_REQUIRED");

  try {
    const result = await rpcCall("getTransaction", {
      hash: clean,
      xdrFormat: "json",
    });

    const ledger = num(result.ledger);

    const envelope = parseEnvelope(result);
    const events = parseEvents(result);

    const useEnvelope =
      envelope.amount || envelope.sender || envelope.receiver;

    const data = useEnvelope ? envelope : events;

    return {
      hash: str(result.txHash) || clean,
      ledger,

      amount: data.amount,
      sender: data.sender,
      receiver: data.receiver,

      memo: data.memo,
      createdAt:
        str(result.createdAt) ||
        str(result.created_at),

      confirmed:
        str(result.status) === "SUCCESS",

      rpcReachable: true,

      raw: result,

      debug: {
        amountFound: !!data.amount,
        senderFound: !!data.sender,
        receiverFound: !!data.receiver,
        parseLayer: useEnvelope
          ? "ENVELOPE"
          : "EVENTS",
        hasMeta: !!result.resultMetaJson,
        hasEvents: !!result.events,
      },
    };
  } catch (e) {
    return {
      hash: clean,
      ledger: null,
      amount: null,
      sender: null,
      receiver: null,
      memo: null,
      createdAt: null,
      confirmed: false,
      rpcReachable: false,
      raw: {},
      debug: {
        amountFound: false,
        senderFound: false,
        receiverFound: false,
        parseLayer: "FAILED",
        hasMeta: false,
        hasEvents: false,
      },
    };
  }
}
