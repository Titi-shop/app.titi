// lib/payments/a2u.rpc.verify.ts

import { getRpcTransaction } from "@/lib/rpc/client";
import {
  getWalletWithdrawalById,
} from "@/lib/db/wallet/wallet.withdraw";

const APP_MERCHANT_WALLET =
  process.env.PI_MERCHANT_WALLET?.trim() ?? "";

function log(
  tag: string,
  data?: unknown
) {
  console.log(
    `[A2U_RPC_VERIFY] ${tag}`,
    data ?? ""
  );
}

export type A2URpcVerifyResult = {
  verified: boolean;

  stage: string;
  reason: string;

  txid: string;

  amount: number | null;

  sender: string | null;
  receiver: string | null;

  ledger: number | null;

  confirmed: boolean;
  memo: string | null;
  rpcReachable: boolean;
  txStatus: string | null;
  chainReference: string | null;
  createdAt: string | null;
  parseLayer: string | null;
  hasMeta: boolean;
  hasEvents: boolean;
feeStroops: number | null;
latestLedger: number | null;
oldestLedger: number | null;
applicationOrder: number | null;
sourceAccount: string | null;
memoType: string | null;
  senderFound: boolean;
  receiverFound: boolean;
  amountFound: boolean;

  raw: unknown;
  
};

export async function verifyA2UWithdrawal(
  withdrawalId: string,
  txid: string
): Promise<A2URpcVerifyResult> {

  log("START", {
    withdrawalId,
    txid,
  });

  const withdrawal =
  await getWalletWithdrawalById(
    withdrawalId
  );

  
    if (!withdrawal) {
  return {
    verified: false,

    stage: "WITHDRAWAL_NOT_FOUND",
    reason: "WITHDRAWAL_NOT_FOUND",

    txid,

    amount: null,
    sender: null,
    receiver: null,

    ledger: null,

    confirmed: false,
    memo: null,

    rpcReachable: false,

    txStatus: null,
    chainReference: null,
    createdAt: null,

    parseLayer: null,

    hasMeta: false,
    hasEvents: false,

    senderFound: false,
    receiverFound: false,
    amountFound: false,
    feeStroops:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.fee ?? null,
  latestLedger:
    Number(raw?.latestLedger)
      || null,
  oldestLedger:
    Number(raw?.oldestLedger)
      || null,
  applicationOrder:
    Number(raw?.applicationOrder)
      || null,
  sourceAccount:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.source_account
      ?? rpc.sender,
  memoType:
    (
      raw?.envelopeJson as any
    )?.tx?.tx?.memo
      ? "text"
      : null,
    raw: null,
  };
}

  const rpc =
    await getRpcTransaction(
      txid
    );

  log("RPC_RESULT", {
    confirmed:
      rpc.confirmed,

    amount:
      rpc.amount,

    sender:
      rpc.sender,

    receiver:
      rpc.receiver,

    ledger:
      rpc.ledger,

    memo:
      rpc.memo,
  });

  if (!rpc.rpcReachable) {
    return {
      verified: false,

      stage:
        "RPC_UNREACHABLE",

      reason:
        "RPC_UNREACHABLE",

      txid,

    amount: null,
    sender: null,
    receiver: null,

    ledger: null,

    confirmed: false,
    memo: null,

    rpcReachable: false,

    txStatus: null,
    chainReference: null,
    createdAt: null,

    parseLayer: null,

    hasMeta: false,
    hasEvents: false,

    senderFound: false,
    receiverFound: false,
    amountFound: false,
feeStroops:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.fee ?? null,
  latestLedger:
    Number(raw?.latestLedger)
      || null,
  oldestLedger:
    Number(raw?.oldestLedger)
      || null,
  applicationOrder:
    Number(raw?.applicationOrder)
      || null,
  sourceAccount:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.source_account
      ?? rpc.sender,
  memoType:
    (
      raw?.envelopeJson as any
    )?.tx?.tx?.memo
      ? "text"
      : null,
    raw: null,
  };
}

  if (!rpc.confirmed) {
    return {
      verified: false,

      stage:
        "TX_NOT_CONFIRMED",

      reason:
        "TX_NOT_CONFIRMED",

      txid,

    amount: null,
    sender: null,
    receiver: null,

    ledger: null,

    confirmed: false,
    memo: null,

    rpcReachable: false,

    txStatus: null,
    chainReference: null,
    createdAt: null,

    parseLayer: null,

    hasMeta: false,
    hasEvents: false,

    senderFound: false,
    receiverFound: false,
    amountFound: false,
feeStroops:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.fee ?? null,
  latestLedger:
    Number(raw?.latestLedger)
      || null,
  oldestLedger:
    Number(raw?.oldestLedger)
      || null,
  applicationOrder:
    Number(raw?.applicationOrder)
      || null,
  sourceAccount:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.source_account
      ?? rpc.sender,
  memoType:
    (
      raw?.envelopeJson as any
    )?.tx?.tx?.memo
      ? "text"
      : null,
    raw: null,
  };
}

  const expectedAmount =
    Number(
      withdrawal.amount
    );

  if (
  rpc.amount === null ||
  Math.abs(
    rpc.amount - expectedAmount
  ) > 0.00000001
) {
    return {
      verified: false,

      stage:
        "AMOUNT_MISMATCH",

      reason:
        "AMOUNT_MISMATCH",

      txid,

    amount: null,
    sender: null,
    receiver: null,

    ledger: null,

    confirmed: false,
    memo: null,

    rpcReachable: false,

    txStatus: null,
    chainReference: null,
    createdAt: null,

    parseLayer: null,

    hasMeta: false,
    hasEvents: false,

    senderFound: false,
    receiverFound: false,
    amountFound: false,
feeStroops:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.fee ?? null,
  latestLedger:
    Number(raw?.latestLedger)
      || null,
  oldestLedger:
    Number(raw?.oldestLedger)
      || null,
  applicationOrder:
    Number(raw?.applicationOrder)
      || null,
  sourceAccount:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.source_account
      ?? rpc.sender,
  memoType:
    (
      raw?.envelopeJson as any
    )?.tx?.tx?.memo
      ? "text"
      : null,
    raw: null,
  };
}

  if (
    rpc.sender
      ?.toLowerCase() !==
    APP_MERCHANT_WALLET
      .toLowerCase()
  ) {
    return {
      verified: false,

      stage:
        "SENDER_MISMATCH",

      reason:
        "SENDER_MISMATCH",

      txid,

    amount: null,
    sender: null,
    receiver: null,

    ledger: null,

    confirmed: false,
    memo: null,

    rpcReachable: false,

    txStatus: null,
    chainReference: null,
    createdAt: null,

    parseLayer: null,

    hasMeta: false,
    hasEvents: false,

    senderFound: false,
    receiverFound: false,
    amountFound: false,
feeStroops:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.fee ?? null,
  latestLedger:
    Number(raw?.latestLedger)
      || null,
  oldestLedger:
    Number(raw?.oldestLedger)
      || null,
  applicationOrder:
    Number(raw?.applicationOrder)
      || null,
  sourceAccount:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.source_account
      ?? rpc.sender,
  memoType:
    (
      raw?.envelopeJson as any
    )?.tx?.tx?.memo
      ? "text"
      : null,
    raw: null,
  };
}

  if (
    rpc.receiver
      ?.toLowerCase() !==
    withdrawal.withdraw_wallet
      .toLowerCase()
  ) {
    return {
      verified: false,

      stage:
        "RECEIVER_MISMATCH",

      reason:
        "RECEIVER_MISMATCH",

      txid,

    amount: null,
    sender: null,
    receiver: null,

    ledger: null,

    confirmed: false,
    memo: null,

    rpcReachable: false,

    txStatus: null,
    chainReference: null,
    createdAt: null,

    parseLayer: null,

    hasMeta: false,
    hasEvents: false,

    senderFound: false,
    receiverFound: false,
    amountFound: false,
feeStroops:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.fee ?? null,
  latestLedger:
    Number(raw?.latestLedger)
      || null,
  oldestLedger:
    Number(raw?.oldestLedger)
      || null,
  applicationOrder:
    Number(raw?.applicationOrder)
      || null,
  sourceAccount:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.source_account
      ?? rpc.sender,
  memoType:
    (
      raw?.envelopeJson as any
    )?.tx?.tx?.memo
      ? "text"
      : null,
    raw: null,
  };
}

  if (
    withdrawal.pi_payment_id &&
    rpc.memo &&
    rpc.memo !==
      withdrawal.pi_payment_id
  ) {
    return {
      verified: false,

      stage:
        "MEMO_MISMATCH",

      reason:
        "MEMO_MISMATCH",

      txid,

    amount: null,
    sender: null,
    receiver: null,

    ledger: null,

    confirmed: false,
    memo: null,

    rpcReachable: false,

    txStatus: null,
    chainReference: null,
    createdAt: null,

    parseLayer: null,

    hasMeta: false,
    hasEvents: false,

    senderFound: false,
    receiverFound: false,
    amountFound: false,
feeStroops:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.fee ?? null,
  latestLedger:
    Number(raw?.latestLedger)
      || null,
  oldestLedger:
    Number(raw?.oldestLedger)
      || null,
  applicationOrder:
    Number(raw?.applicationOrder)
      || null,
  sourceAccount:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.source_account
      ?? rpc.sender,
  memoType:
    (
      raw?.envelopeJson as any
    )?.tx?.tx?.memo
      ? "text"
      : null,
    raw: null,
  };
}

    return {
  verified: true,

  stage: "RPC_OK",
  reason: "NONE",

  txid,

  amount: rpc.amount,

  sender: rpc.sender,
  receiver: rpc.receiver,

  ledger: rpc.ledger,

  confirmed: rpc.confirmed,

  memo: rpc.memo,

  rpcReachable: true,

  txStatus: rpc.txStatus ?? null,
  chainReference: rpc.hash ?? txid,

  createdAt: rpc.createdAt ?? null,

  parseLayer:
    rpc.debug.parseLayer ?? null,

  hasMeta:
    rpc.debug.hasMeta,

  hasEvents:
    rpc.debug.hasEvents,

  senderFound:
    rpc.debug.senderFound,

  receiverFound:
    rpc.debug.receiverFound,

  amountFound:
    rpc.debug.amountFound,
feeStroops:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.fee ?? null,
  latestLedger:
    Number(raw?.latestLedger)
      || null,
  oldestLedger:
    Number(raw?.oldestLedger)
      || null,
  applicationOrder:
    Number(raw?.applicationOrder)
      || null,
  sourceAccount:

    (
      raw?.envelopeJson as any
    )?.tx?.tx?.source_account
      ?? rpc.sender,
  memoType:
    (
      raw?.envelopeJson as any
    )?.tx?.tx?.memo
      ? "text"
      : null,
  raw: rpc.raw,
};
}
