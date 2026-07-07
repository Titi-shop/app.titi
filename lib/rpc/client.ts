const PI_RPC_URL =
  process.env.PI_RPC_URL?.trim() ||
  "https://rpc.testnet.minepi.com";

import type {
  ParsedRpcTransaction,
} from "@/lib/payments/types/rpc.types";

import type {
  RpcEnvelope,
  JsonObj,
} from "@/lib/rpc/rpc.internal.types";
import {
  logger,
  maskId,
} from "@/lib/logger";
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

function asObj(value: unknown): JsonObj {
  return typeof value === "object" && value !== null
    ? (value as JsonObj)
    : {};
}

function asArr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === "string"
    ? value.trim()
    : null;
}

function num(value: unknown): number | null {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}

function deepFindString(
  node: unknown,
  keys: string[]
): string | null {
  if (!node || typeof node !== "object") {
    return null;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = deepFindString(item, keys);

      if (found) {
        return found;
      }
    }

    return null;
  }

  const obj = node as JsonObj;

  for (const key of keys) {
    const value = obj[key];

    if (typeof value === "string") {
      const cleaned = value.trim();

      if (cleaned) {
        return cleaned;
      }
    }
  }

  for (const value of Object.values(obj)) {
    const found = deepFindString(value, keys);

    if (found) {
      return found;
    }
  }

  return null;
}

function deepFindNumber(
  node: unknown,
  keys: string[]
): number | null {
  if (!node || typeof node !== "object") {
    return null;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = deepFindNumber(item, keys);

      if (found !== null) {
        return found;
      }
    }

    return null;
  }

  const obj = node as JsonObj;

  for (const key of keys) {
    const parsed = num(obj[key]);

    if (parsed !== null) {
      return parsed;
    }
  }

  for (const value of Object.values(obj)) {
    const found = deepFindNumber(value, keys);

    if (found !== null) {
      return found;
    }
  }

  return null;
}

const STROOPS_PER_PI = 10_000_000;

function normalizeAmount(
  amount: number | null
): number | null {
  if (amount === null) {
    return null;
  }

  /**
   * RPC getTransaction đang trả amount
   * dưới dạng stroops.
   *
   * Chuẩn hoá toàn bộ hệ thống về PI.
   */
  return amount / STROOPS_PER_PI;
}

/* =========================================================
   RPC CALL
========================================================= */

async function rpcCall(
  method: string,
  params: Record<string, unknown>
): Promise<JsonObj> {
  logger.debug(
  "RPC_CLIENT.CALL_START",
  {
    method,
  }
);

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
    logger.error(
  "RPC_CLIENT.NETWORK_FAIL",
  {
    message:
      e instanceof Error
        ? e.message
        : String(e),
  }
);

    throw new Error("RPC_UNREACHABLE");
  }

  const rawText = await response.text();

  let parsed: RpcEnvelope;

  try {
    parsed = JSON.parse(rawText) as RpcEnvelope;
  } catch {
    logger.error(
  "RPC_CLIENT.INVALID_JSON",
  {
    length: rawText.length,
  }
);

    throw new Error("RPC_INVALID_JSON");
  }

  if (!response.ok) {
    err("RPC_HTTP_FAIL", {
      status: response.status,
    });

    throw new Error(`RPC_HTTP_${response.status}`);
  }

  if (parsed.error) {
    logger.error(
  "RPC_CLIENT.METHOD_FAIL",
  {
    code: parsed.error?.code,
    message: parsed.error?.message,
  }
);

    throw new Error("RPC_ERROR");
  }

  if (!parsed.result) {
    err("RPC_EMPTY_RESULT");

    throw new Error("RPC_EMPTY_RESULT");
  }

  log("RPC_CALL_OK");

  return parsed.result;
}

/* =========================================================
   PARSE ENVELOPE
========================================================= */

function parseFromEnvelopeJson(
  result: JsonObj
): {
  amount: number | null;
  sender: string | null;
  receiver: string | null;
} {
  const sender =
    deepFindString(result, [
      "sourceAccount",
      "source_account",
      "from",
      "from_address",
      "account_id",
    ]) ?? null;

  const receiver =
    deepFindString(result, [
      "destination",
      "to",
      "to_address",
      "toAccount",
    ]) ?? null;

  const amount = normalizeAmount(
    deepFindNumber(result, [
      "amount",
      "sendAmount",
      "value",
      "i128",
    ])
  );

  return {
    amount,
    sender,
    receiver,
  };
}

/* =========================================================
   PARSE EVENTS
========================================================= */

function parseFromEvents(
  result: JsonObj
): {
  amount: number | null;
  sender: string | null;
  receiver: string | null;
} {
  const events = asObj(result.events);

  const txEvents = asArr(
    events.transactionEventsJson
  );

  const contractEvents = asArr(
    events.contractEventsJson
  );

  const sender =
    deepFindString(txEvents, [
      "from",
      "source",
      "address",
    ]) ??
    deepFindString(contractEvents, [
      "from",
      "source",
      "address",
    ]) ??
    null;

  const receiver =
    deepFindString(contractEvents, [
      "destination",
      "to",
      "address",
    ]) ?? null;

  const amount = normalizeAmount(
    deepFindNumber(contractEvents, [
      "amount",
      "value",
      "i128",
    ])
  );

  return {
    amount,
    sender,
    receiver,
  };
}

/* =========================================================
   MAIN
========================================================= */

export async function getRpcTransaction(
  txid: string
): Promise<ParsedRpcTransaction> {
  const clean = txid.trim();

  logger.info(
  "RPC_CLIENT.GET_TX_START",
  {
    txid: maskId(clean),
  }
);

  if (!clean) {
    throw new Error("RPC_TXID_REQUIRED");
  }

  try {
    const result = await rpcCall(
      "getTransaction",
      {
        hash: clean,
        xdrFormat: "json",
      }
    );

    const ledger = num(result.ledger);

    const status =
      str(result.status) ??
      str(result.txStatus) ??
      null;
const resultJson = asObj(result.resultJson);

const feeStroops =
  num(resultJson.fee_charged);

const feePi =
  feeStroops === null
    ? null
    : feeStroops / STROOPS_PER_PI;

    const confirmed =
      status === "SUCCESS" ||
      status === "FAILED" ||
      ledger !== null;
const successful =
  status === "SUCCESS";

const latestLedger =
  num(result.latestLedger);

const oldestLedger =
  num(result.oldestLedger);

const applicationOrder =
  num(result.applicationOrder);

const network =
  str(result.network) ??
  "Pi Testnet";
    /* =====================================================
       ENVELOPE
    ===================================================== */

    const envelopeJson = asObj(
      result.envelopeJson
    );

    const envelopeTx = asObj(
      envelopeJson.tx
    );

    const innerTx = asObj(
      envelopeTx.tx
    );
const operations = asArr(innerTx.operations);
const operationCount = operations.length;
    const firstOperation = asObj(
  operations[0]
);

const paymentBody = asObj(
  asObj(firstOperation.body).payment
);

const chainPaymentAmount =
  normalizeAmount(
    num(paymentBody.amount)
  );

const contractEvents = asArr(
  asObj(result.events).contractEventsJson
);

let chainEventAmount: number | null = null;

for (const group of contractEvents) {
  if (!Array.isArray(group)) continue;

  for (const event of group) {
    const map = asArr(
      asObj(
        asObj(
          asObj(
            asObj(event).body
          ).v0
        ).data
      ).map
    );

    for (const entry of map) {
      const item = asObj(entry);

      const key = asObj(item.key);
      const val = asObj(item.val);

      if (key.symbol === "amount") {
        chainEventAmount = normalizeAmount(
          num(val.i128)
        );

        break;
      }
    }

    if (chainEventAmount !== null) {
      break;
    }
  }

  if (chainEventAmount !== null) {
    break;
  }
}
    const senderBalanceDelta: number | null = null;
const receiverBalanceDelta: number | null = null;
    const chainAmountConsensus =
  chainPaymentAmount !== null &&
  chainEventAmount !== null &&
  Math.abs(
    chainPaymentAmount -
    chainEventAmount
  ) < 0.0000001;
    const memoObj = asObj(
      innerTx.memo
    );
    const sourceAccount =
  str(innerTx.source_account) ??
  str(result.sourceAccount) ??
  null;

    /* =====================================================
       MEMO
    ===================================================== */

    let memo: string | null = null;
let memoType: string | null = null;

if (str(memoObj.text)) {
  memo = str(memoObj.text);
  memoType = "text";
} else if (str(memoObj.id)) {
  memo = str(memoObj.id);
  memoType = "id";
} else if (str(memoObj.hash)) {
  memo = str(memoObj.hash);
  memoType = "hash";
}

    /* =====================================================
       CREATED AT
    ===================================================== */

    const createdAt =
      str(result.createdAt) ??
      str(result.created_at) ??
      str(result.created) ??
      null;

    /* =====================================================
       PARSING
    ===================================================== */

    let amount: number | null = null;
    let sender: string | null = null;
    let receiver: string | null = null;
    let parseLayer = "NONE";

    /* ===== LAYER A ===== */

    const parsedEnvelope =
      parseFromEnvelopeJson(result);

    if (
      parsedEnvelope.amount !== null ||
      parsedEnvelope.sender ||
      parsedEnvelope.receiver
    ) {
      amount = parsedEnvelope.amount;
      sender = parsedEnvelope.sender;
      receiver = parsedEnvelope.receiver;
      parseLayer = "ENVELOPE_JSON";
    }

    /* ===== LAYER B ===== */

    if (
      amount === null &&
      !sender &&
      !receiver
    ) {
      const parsedEvents =
        parseFromEvents(result);

      if (
        parsedEvents.amount !== null ||
        parsedEvents.sender ||
        parsedEvents.receiver
      ) {
        amount = parsedEvents.amount;
        sender = parsedEvents.sender;
        receiver = parsedEvents.receiver;
        parseLayer = "EVENTS";
      }
    }
    logger.info(
  "RPC_CLIENT.PARSE_RESULT",
  {
    txid: maskId(clean),
    amount,
    ledger,
    confirmed,
    parseLayer,
  }
);
logger.debug(
  "RPC_CLIENT.NORMALIZED_AMOUNT",
  {
    txid: maskId(clean),
    amount,
  }
);

return {
  hash:
    str(result.txHash) ?? clean,

  ledger,
  amount,
  sender,
  receiver,
  memo,
  memoType,
  createdAt,

  txStatus:
    status ??
    (confirmed
      ? "SUCCESS"
      : "UNKNOWN"),

  confirmed,
  successful,
  rpcReachable: true,
  feeStroops,
  feePi,

  latestLedger,
  oldestLedger,
  applicationOrder,
  operationCount,
  chainPaymentAmount,
  chainEventAmount,
  chainAmountConsensus,
senderBalanceDelta,
receiverBalanceDelta,
  sourceAccount,
  network,
  raw: result,

  debug: {
    amountFound:
      amount !== null,
    senderFound:
      !!sender,
    receiverFound:
      !!receiver,
    parseLayer,
    hasMeta:
      !!result.resultMetaJson ||
      !!result.resultMetaXdr,
    hasEvents:
      !!result.events,
  },
};
  } catch (e) {
    logger.error(
  "RPC_CLIENT.GET_TX_FAIL",
  {
    txid: maskId(clean),
    message:
      e instanceof Error
        ? e.message
        : String(e),
  }
);

    return {
  hash: clean,
  ledger: null,
  amount: null,
  chainPaymentAmount: null,
chainEventAmount: null,

chainAmountConsensus: null,
senderBalanceDelta: null,
receiverBalanceDelta: null,
  sender: null,
  receiver: null,

  memo: null,
  memoType: null,
  createdAt: null,
  txStatus: null,
  confirmed: false,
  successful: false,
  rpcReachable: false,
  feeStroops: null,
  feePi: null,
  latestLedger: null,
  oldestLedger: null,

  applicationOrder: null,
  operationCount: null,
  sourceAccount: null,
  network: null,
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
