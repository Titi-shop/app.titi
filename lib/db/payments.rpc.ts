
import crypto from "crypto";
import { query } from "@/lib/db";
import { getRpcTransaction } from "@/lib/rpc/client";

import type {
  RpcVerifyResult,
  PaymentIntentRow,
} from "@/lib/payments/types/rpc.types";

import type {
  InsertRpcLogInput,
} from "@/lib/payments/types/rpc.db.types";
import {
  logger,
  maskId,
  maskWallet,
} from "@/lib/logger";

/* =========================================================
   INPUT TYPE (local only)
========================================================= */

type VerifyRpcParams = {
  paymentIntentId: string;
  piPaymentId: string | null;
  txid: string;
};


/* =========================================================
   HELPERS
========================================================= */
function normalizeRpcAmount(amount: number | null): number | null {
  if (amount === null) return null;

  // Pi RPC trả về stroop (10^7)
  if (amount > 1_000_000) {
    return amount / 10_000_000;
  }

  return amount;
}
function isUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function normalizeWallet(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0000001;
}

function buildVerificationHash(input: {
  paymentIntentId: string;
  txid: string;
  amount: number | null;
  sender: string | null;
  receiver: string | null;
  ledger: number | null;
}): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        paymentIntentId: input.paymentIntentId,
        txid: input.txid,
        amount: input.amount,
        sender: input.sender,
        receiver: input.receiver,
        ledger: input.ledger,
      })
    )
    .digest("hex");
}

/* =========================================================
   DB FETCH INTENT
========================================================= */

async function getPaymentIntent(
  paymentIntentId: string
): Promise<PaymentIntentRow | null> {
  logger.debug("RPC.DB_FETCH_INTENT_START", {
  paymentIntentId: maskId(paymentIntentId),
});

  const rs = await query<PaymentIntentRow>(
    `
    SELECT
      id,
      total_amount,
      merchant_wallet
    FROM payment_intents
    WHERE id = $1
    LIMIT 1
    `,
    [paymentIntentId]
  );

  const row = rs.rows[0] ?? null;
  logger.info("RPC.DB_FETCH_INTENT_RESULT", {
  found: !!row,
  paymentIntentId: maskId(paymentIntentId),
});
  return row;
}

/* =========================================================
   DB INSERT RPC LOG
========================================================= */

async function insertRpcLog(
  input: InsertRpcLogInput
): Promise<void> {
  logger.info("RPC.DB_LOG_INSERT", {
  txid: maskId(input.txid),
  verified: input.verified,
  stage: input.stage,
  reason: input.reason,
});

  const values = [
  input.paymentIntentId,
  input.piPaymentId,
  input.txid,
  input.verified,
  input.stage,
  input.reason,
  input.amount,
  input.expectedAmount,

  input.sender,
  input.receiver,
  input.expectedReceiver,

  input.amountMatch,
  input.receiverMatch,
  input.senderMatch,

  input.mismatchReason,
  input.fraudReason,

  input.verificationHash,
  input.ledger,
  input.txStatus,
  input.chainReference,

  JSON.stringify(input.payload ?? {}),

  input.rpcReachable,
  input.expectedSender,
  input.expectedMemo,
  input.memoMatch,
  input.memoFound,
  input.network,
  input.verificationVersion,
  input.verificationMethod,
  JSON.stringify(input.verificationSnapshot ?? {}),

  input.feeStroops,
  input.feePi,
  input.latestLedger,
  input.oldestLedger,
  input.applicationOrder,

  input.successful,
  input.operationCount,

  input.sourceAccount,
  input.memoType,

  input.chainPaymentAmount,
  input.chainEventAmount,
  input.senderBalanceDelta,
  input.receiverBalanceDelta,
  input.chainAmountConsensus,

  input.confirmed,
  input.parseLayer,
  input.hasMeta,
  input.hasEvents,
  input.senderFound,
  input.receiverFound,
  input.amountFound,
  input.createdAt,
  input.memo,
];

await query(
  `
  INSERT INTO rpc_verification_logs (
    payment_intent_id,
    pi_payment_id,
    txid,
    verified,
    stage,
    reason,
    amount,
    expected_amount,
    sender,
    receiver,
    expected_receiver,
    amount_match,
    receiver_match,
    sender_match,
    mismatch_reason,
    fraud_reason,
    verification_hash,
    ledger,
    tx_status,
    chain_reference,
    verify_mode,
    payload,
    verified_at,
    created_at,
    updated_at,
    rpc_reachable,
    expected_sender,
expected_memo,

memo_match,
memo_found,

network,

verification_version,
verification_method,

verification_snapshot,

fee_stroops,
fee_pi,

latest_ledger,
oldest_ledger,
application_order,

successful,
operation_count,

source_account,
memo_type,

chain_payment_amount,
chain_event_amount,

sender_balance_delta,
receiver_balance_delta,

chain_amount_consensus,
confirmed,
parse_layer,
has_meta,
has_events,
sender_found,
receiver_found,
amount_found,
created_at_chain,
memo
  )
  VALUES (
  $1,$2,
  $3,
  $4,
  $5,$6,
  $7,$8,
  $9,$10,$11,
  $12,$13,$14,
  $15,$16,
  $17,
  $18,
  $19,$20,

  'raw_tx',

  $21::jsonb,

  COALESCE(
  CASE
    WHEN $4 = true THEN now()
    ELSE NULL
  END,
  now()
),

  now(),
  now(),

  $22,
  $23,
  $24,
  $25,
  $26,
  $27,
$28,
$29,
$30,
$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,
$44,$45,$46,$47,$48,$49,$50,$51,$52,$53
)
  ON CONFLICT (txid)
  DO UPDATE SET
    verified = EXCLUDED.verified,
    stage = EXCLUDED.stage,
    reason = EXCLUDED.reason,
    amount = EXCLUDED.amount,
    expected_amount = EXCLUDED.expected_amount,
    sender = EXCLUDED.sender,
    receiver = EXCLUDED.receiver,
    expected_receiver = EXCLUDED.expected_receiver,
    amount_match = EXCLUDED.amount_match,
    receiver_match = EXCLUDED.receiver_match,
    sender_match = EXCLUDED.sender_match,

    mismatch_reason = EXCLUDED.mismatch_reason,
    fraud_reason = EXCLUDED.fraud_reason,
    verification_hash = EXCLUDED.verification_hash,
    ledger = EXCLUDED.ledger,
    tx_status = EXCLUDED.tx_status,
    chain_reference = EXCLUDED.chain_reference,
    payload = EXCLUDED.payload,
    verified_at =
      CASE
        WHEN EXCLUDED.verified = true
        THEN now()
        ELSE rpc_verification_logs.verified_at
      END,

    created_at_chain = EXCLUDED.created_at_chain,
memo = EXCLUDED.memo,
updated_at = now()
`,
  values
);
}
/* =========================================================
   BUILD RESULT FROM RPC LOG
========================================================= */

function buildRpcVerifyResult(
  rpcLog: Awaited<
    ReturnType<typeof getRpcVerificationLog>
  >
): RpcVerifyResult {
  return {
    ok: rpcLog.verified,
    audited: true,

    verified: rpcLog.verified,

    amount: rpcLog.amount,
    sender: rpcLog.sender,
    receiver: rpcLog.receiver,

    ledger: rpcLog.ledger,

    confirmed: rpcLog.confirmed,

    txStatus: rpcLog.txStatus,
    chainReference: rpcLog.chainReference,

    payload: rpcLog.payload,

    reason: rpcLog.reason,
    stage: rpcLog.stage,

    createdAt: rpcLog.createdAt,
    memo: rpcLog.memo,
  };
}
/* =========================================================
   MAIN RPC VERIFY
========================================================= */

export async function verifyRpcPaymentForReconcile({
  paymentIntentId,
  piPaymentId,
  txid,
}: VerifyRpcParams): Promise<RpcVerifyResult> {
  logger.info("RPC.START", {
  paymentIntentId: maskId(paymentIntentId),
  txid: maskId(txid),
});

  if (!isUUID(paymentIntentId) || !txid.trim()) {
    fail("INVALID_INPUT", {
  paymentIntentId: maskId(paymentIntentId),
  txid: maskId(txid),
});

    throw new Error("INVALID_RPC_VERIFY_INPUT");
  }

  /* =====================================================
     FETCH INTENT
  ===================================================== */

  const intent = await getPaymentIntent(paymentIntentId);

  if (!intent) {
    logger.error("RPC.INTENT_NOT_FOUND", {
  paymentIntentId: maskId(paymentIntentId),
});

    throw new Error("PAYMENT_INTENT_NOT_FOUND");
  }

  const expectedAmountRaw = Number(intent.total_amount);
const expectedAmount =
  expectedAmountRaw > 1_000_000
    ? expectedAmountRaw / 10_000_000
    : expectedAmountRaw;
  const expectedReceiver = normalizeWallet(
    intent.merchant_wallet
  );

  logger.debug("RPC.INTENT_EXPECTED", {
  expectedReceiver: maskWallet(expectedReceiver),
});

  /* =====================================================
     FETCH RPC TX
  ===================================================== */

  const rpcTx = await getRpcTransaction(txid);
  const chainAmountConsensus =
  rpcTx.chainPaymentAmount !== null &&
  rpcTx.chainEventAmount !== null &&
  sameAmount(
    rpcTx.chainPaymentAmount,
    rpcTx.chainEventAmount
  );
  logger.debug("RPC.RAW_RESULT", {
  confirmed: rpcTx.confirmed,
  txStatus: rpcTx.txStatus,
  sender: maskWallet(rpcTx.sender),
  receiver: maskWallet(rpcTx.receiver),
  chainReference: maskId(rpcTx.hash),
  memo: maskId(rpcTx.memo),
});
logger.debug("RPC.CHAIN_PAYMENT_PRESENT", {
    found:
        rpcTx.chainPaymentAmount !== null,
});
  logger.debug("RPC.TRACE", {
    rpcReachable: rpcTx.rpcReachable,
    confirmed: rpcTx.confirmed,
    amountFound: rpcTx.debug.amountFound,
    senderFound: rpcTx.debug.senderFound,
    receiverFound: rpcTx.debug.receiverFound,
    parseLayer: rpcTx.debug.parseLayer,
    hasMeta: rpcTx.debug.hasMeta,
    hasEvents: rpcTx.debug.hasEvents,
  });

  /* =====================================================
     MATCH FLAGS
  ===================================================== */

  const normalizedRpcAmount = normalizeRpcAmount(rpcTx.amount);

const amountMatch =
  normalizedRpcAmount !== null &&
  sameAmount(normalizedRpcAmount, expectedAmount);
  const receiverMatch =
    !!rpcTx.receiver &&
    normalizeWallet(rpcTx.receiver) ===
      expectedReceiver;

  const senderMatch = !!rpcTx.sender;
const senderFound = rpcTx.debug.senderFound;
const receiverFound = rpcTx.debug.receiverFound;
const amountFound = rpcTx.debug.amountFound;
const parseLayer = rpcTx.debug.parseLayer ?? null;
const hasMeta = rpcTx.debug.hasMeta;
const hasEvents = rpcTx.debug.hasEvents;
  /* =====================================================
     VALIDATION
  ===================================================== */

  let verified = true;
  let stage = "RPC_OK";
  let reason = "NONE";
  if (!rpcTx.rpcReachable) {
    verified = false;
    stage = "RPC_UNREACHABLE";
    reason = "RPC_UNREACHABLE";

    warn(stage, reason);
  } else if (!rpcTx.confirmed) {
    verified = false;
    stage = "RPC_NOT_CONFIRMED";
    reason = "TX_NOT_CONFIRMED";

    warn(stage, reason);
  } else if (rpcTx.amount === null) {
    verified = false;
    stage = "RPC_AMOUNT_UNREADABLE";
    reason = "AMOUNT_NOT_READABLE";

    warn(stage, {
      parseLayer: rpcTx.debug.parseLayer,
    });
  } else if (!amountMatch) {
    verified = false;
    stage = "RPC_AMOUNT_MISMATCH";
    reason = "AMOUNT_MISMATCH";

    warn(stage,{
    amountMismatch:true
});
  } else if (!rpcTx.receiver) {
    verified = false;
    stage = "RPC_RECEIVER_UNREADABLE";
    reason = "RECEIVER_NOT_READABLE";

    warn(stage, {
      parseLayer: rpcTx.debug.parseLayer,
    });
  } else if (!receiverMatch) {
    verified = false;
    stage = "RPC_RECEIVER_MISMATCH";
    reason = "RECEIVER_MISMATCH";

    warn(stage,{
    receiverMismatch:true
});
  }

  /* =====================================================
     FORENSIC SNAPSHOT
  ===================================================== */

  let mismatchReason = "NONE";
  if (!amountMatch) {
    mismatchReason = "AMOUNT_MISMATCH";
  } else if (!receiverMatch) {
    mismatchReason = "RECEIVER_MISMATCH";
  }
  let fraudReason = "NONE";
if (!rpcTx.rpcReachable) {
  fraudReason = "RPC_UNREACHABLE";
} else if (!rpcTx.confirmed) {
  fraudReason = "UNCONFIRMED_TX";
} else if (!amountMatch) {
  fraudReason = "AMOUNT_MISMATCH";
} else if (!receiverMatch) {
  fraudReason = "RECEIVER_MISMATCH";
}

  const verificationHash = buildVerificationHash({
    paymentIntentId,
    txid,
    amount: rpcTx.amount,
    sender: rpcTx.sender,
    receiver: rpcTx.receiver,
    ledger: rpcTx.ledger,
  });

  logger.info("RPC.FINAL_RESULT", {
  verified,
  stage,
  reason,

  amountMatch,
  receiverMatch,

  senderFound,
  receiverFound,
  amountFound,

  rpcReachable: rpcTx.rpcReachable,
  confirmed: rpcTx.confirmed,

  parseLayer,
  hasMeta,
  hasEvents,
});

  /* =====================================================
     INSERT FORENSIC LOG
  ===================================================== */
  const txStatus =
  rpcTx.txStatus ??
  (rpcTx.confirmed
    ? "SUCCESS"
    : "FAILED");

  await insertRpcLog({
    paymentIntentId,
    piPaymentId,
    txid,
    verified,
    stage,
    reason,
    amount: rpcTx.amount,
    expectedAmount,
    sender: rpcTx.sender,
    receiver: rpcTx.receiver,
    expectedReceiver,
    amountMatch,
    receiverMatch,
    senderMatch,
    mismatchReason,
    fraudReason,
    verificationHash,
    ledger: rpcTx.ledger,
    txStatus,
    chainReference: rpcTx.hash,
rpcReachable: rpcTx.rpcReachable,
confirmed: rpcTx.confirmed,
parseLayer,
hasMeta,
hasEvents,
senderFound,
receiverFound,
amountFound,
    payload: rpcTx.raw,
createdAt: rpcTx.createdAt ?? null,
memo: rpcTx.memo ?? null,
    expectedSender: null,
expectedMemo: piPaymentId,

memoMatch:
  piPaymentId
    ? rpcTx.memo === piPaymentId
    : null,

memoFound:
  rpcTx.memo !== null,

network:
  rpcTx.network,

verificationVersion: 1,
verificationMethod: "RPC",
verificationSnapshot: {
  amountMatch,
  receiverMatch,
},

successful:
  rpcTx.successful,

operationCount:
  rpcTx.operationCount,

feeStroops:
  rpcTx.feeStroops,

feePi:
  rpcTx.feePi,

latestLedger:
  rpcTx.latestLedger,

oldestLedger:
  rpcTx.oldestLedger,

applicationOrder:
  rpcTx.applicationOrder,

sourceAccount:
  rpcTx.sourceAccount,

memoType:
  rpcTx.memoType,

chainPaymentAmount:
    rpcTx.chainPaymentAmount,

chainEventAmount:
    rpcTx.chainEventAmount,

senderBalanceDelta:
    rpcTx.senderBalanceDelta,

receiverBalanceDelta:
    rpcTx.receiverBalanceDelta,

   chainAmountConsensus,
  });
const rpcLog =
  await getRpcVerificationLog(paymentIntentId);
  /* =====================================================
     RESULT
  ===================================================== */

  return buildRpcVerifyResult(rpcLog);
}
/* =========================================================
   READ VERIFIED RPC LOG
========================================================= */

export async function getRpcVerificationLog(
  paymentIntentId: string
) {
  logger.debug("RPC.DB_FETCH_RPC_LOG_START", {
    paymentIntentId: maskId(paymentIntentId),
});

  if (!isUUID(paymentIntentId)) {
    throw new Error("INVALID_PAYMENT_INTENT_ID");
  }

  const rs = await query(
    `
    SELECT
      payment_intent_id,
      pi_payment_id,
      txid,

      verified,
      stage,
      reason,

      amount,
      expected_amount,

      sender,
      receiver,
      expected_receiver,

      amount_match,
      receiver_match,
      sender_match,

      ledger,
      tx_status,
      chain_reference,

      rpc_reachable,
      confirmed,

      parse_layer,
      has_meta,
      has_events,

      sender_found,
      receiver_found,
      amount_found,

      payload,

      created_at_chain,
      memo,

      verification_hash,

      verified_at,
      created_at,
      updated_at
    FROM rpc_verification_logs
    WHERE payment_intent_id = $1
    LIMIT 1
    `,
    [paymentIntentId]
  );

  const row = rs.rows[0] ?? null;

  if (!row) {
    throw new Error("RPC_VERIFICATION_LOG_NOT_FOUND");
  }

  logger.info("RPC.DB_FETCH_RPC_LOG_DONE", {
    paymentIntentId: maskId(paymentIntentId),
    verified: row.verified,
    stage: row.stage,
    reason: row.reason,
});

  return {
  ...row,

  txStatus: row.tx_status,
  chainReference: row.chain_reference,

  expectedAmount: row.expected_amount,
  expectedReceiver: row.expected_receiver,

  amountMatch: row.amount_match,
  receiverMatch: row.receiver_match,
  senderMatch: row.sender_match,

  rpcReachable: row.rpc_reachable,

  parseLayer: row.parse_layer,
  hasMeta: row.has_meta,
  hasEvents: row.has_events,

  senderFound: row.sender_found,
  receiverFound: row.receiver_found,
  amountFound: row.amount_found,

  createdAt: row.created_at_chain,
};
}
