import { query } from "@/lib/db";
import { getRpcTransaction } from "@/lib/rpc/client";
import {
  upsertWithdrawalReceipt,
} from "@/lib/db/wallet/wallet.withdraw.receipt";
import {
  getWalletWithdrawalById,
} from "@/lib/db/wallet/wallet.withdraw";
export type InsertA2URpcLogInput = {
  withdrawalId: string;
  piPaymentId: string | null;
  txid: string;
  verified: boolean;
  amount: number | null;

  sender: string | null;
  receiver: string | null;

  ledger: number | null;
  memo: string | null;
  txStatus: string | null;
  chainReference: string | null;
  createdAt: string | null;
  rpcReachable: boolean;
  parseLayer: string | null;
  hasMeta: boolean;
  hasEvents: boolean;
  senderFound: boolean;
  receiverFound: boolean;
  amountFound: boolean;
  payload: unknown;
  stage: string;
reason: string;
expectedAmount: number | null;
expectedReceiver: string | null;
  expectedSender: string | null;
expectedMemo: string | null;
memoMatch: boolean | null;
memoFound: boolean | null;
network: string | null;
verificationVersion: number | null;
verificationMethod: string | null;
feePi: number | null;
verificationSnapshot: unknown;
chainPaymentAmount:
  number | null;
chainEventAmount:
  number | null;
senderBalanceDelta:
  number | null;
receiverBalanceDelta:
  number | null;
chainAmountConsensus:
  boolean | null;
amountMatch: boolean | null;
receiverMatch: boolean | null;
senderMatch: boolean | null;
verificationHash: string | null;
confirmed: boolean;
feeStroops: number | null;
latestLedger: number | null;
oldestLedger: number | null;
applicationOrder: number | null;
sourceAccount: string | null;
memoType: string | null;
};
export type RpcVerificationRow = {
  withdrawal_id: string;
  txid: string;
  ledger: number | null;
  sender: string | null;
  receiver: string | null;
  memo: string | null;
  network: string | null;
  verified: boolean;
  stage: string;
  amount: number | null;
  expected_amount: number | null;
  amount_match: boolean | null;
  sender_match: boolean | null;
  receiver_match: boolean | null;
  memo_match: boolean | null;
  chain_amount_consensus: boolean | null;
  tx_status: string | null;
reason: string | null;
confirmed: boolean;
  successful: boolean;
operationCount: number | null;
chain_reference: string | null;
verification_hash: string | null;
payload: unknown;
rpc_reachable: boolean;
created_at_chain: string | null;
parse_layer: string | null;
verification_version: number | null;
verification_method: string | null;
expected_sender: string | null;
expected_receiver: string | null;
expected_memo: string | null;
memo_found: boolean | null;
source_account: string | null;
memo_type: string | null;

};

function log(
  tag: string,
  data?: unknown
) {
  console.log(
    `[A2U_RPC_DB] ${tag}`,
    data ?? ""
  );
}

export async function insertA2URpcLog(
  input: InsertA2URpcLogInput
): Promise<void> {
  log("INSERT_START", {
    withdrawalId: input.withdrawalId,
    txid: input.txid,
  });
  const values = [
  input.withdrawalId,           // $1
  input.piPaymentId,            // $2

  input.txid,                   // $3
  input.verified,               // $4

  input.stage,                  // $5
  input.reason,                 // $6

  input.amount,                 // $7
  input.expectedAmount,         // $8

  input.sender,                 // $9
  input.receiver,               // $10

  input.expectedReceiver,       // $11
  input.expectedSender,         // $12

  input.amountMatch,            // $13
  input.receiverMatch,          // $14
  input.senderMatch,            // $15

  input.expectedMemo,           // $16
  input.memoMatch,              // $17
  input.memoFound,              // $18

  input.network,                // $19

  input.verificationVersion,    // $20
  input.verificationMethod,     // $21

  input.verificationHash,       // $22

  input.ledger,                 // $23
  input.txStatus,               // $24
  input.chainReference,         // $25

  input.rpcReachable,           // $26
  input.confirmed,              // $27

  input.parseLayer,             // $28

  input.hasMeta,                // $29
  input.hasEvents,              // $30

  input.senderFound,            // $31
  input.receiverFound,          // $32
  input.amountFound,            // $33

  input.feeStroops,             // $34
  input.feePi,                  // $35

  input.latestLedger,           // $36
  input.oldestLedger,           // $37

  input.applicationOrder,       // $38

  input.chainPaymentAmount,     // $39
  input.chainEventAmount,       // $40

  input.senderBalanceDelta,     // $41
  input.receiverBalanceDelta,   // $42

  input.chainAmountConsensus,   // $43

  JSON.stringify(
    input.verificationSnapshot ?? {}
  ),                            // $44

  input.sourceAccount,          // $45
  input.memoType,               // $46

  input.memo,                   // $47
  input.createdAt,              // $48

  JSON.stringify(
    input.payload ?? {}
  ),                            // $49
];

console.log(
  "[RPC_VALUES_LENGTH]",
  values.length
);

console.log(
  "[RPC_VALUES]",
  values
);
  await query(
  `
  INSERT INTO rpc_verification_logs (
    withdrawal_id,
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
expected_sender,
amount_match,
receiver_match,
sender_match,
expected_memo,
memo_match,
memo_found,
network,
verification_version,
verification_method,
    verification_hash,
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
    fee_stroops,
fee_pi,
latest_ledger,
oldest_ledger,
application_order,
chain_payment_amount,
chain_event_amount,
sender_balance_delta,
receiver_balance_delta,
chain_amount_consensus,
verification_snapshot,
    source_account,
    memo_type,
    memo,
    created_at_chain,
    payload
  )
  VALUES (
  $1,$2,
  $3,$4,
  $5,$6,
  $7,$8,
  $9,$10,$11,$12,
  $13,$14,$15,
  $16,$17,$18,
  $19,
  $20,$21,
  $22,
  $23,
  $24,$25,$26,
  $27,$28,
  $29,
  $30,$31,
  $32,$33,$34,
  $35,$36,
  $37,$38,$39,
  $40,$41,$42,$43,
  $44::jsonb,
  $45,$46,$47,$48,
  $49::jsonb
  )
  `,
  values
);
  log("INSERT_DONE", {
    txid: input.txid,
  });
}
export async function verifyWithdrawalRpc(
  withdrawalId: string,
  txid: string
): Promise<RpcVerificationRow> {

  log("VERIFY_START", {
    withdrawalId,
    txid,
  });

  const withdrawal =
    await getWalletWithdrawalById(
      withdrawalId
    );

  if (!withdrawal) {
    throw new Error(
      "WITHDRAWAL_NOT_FOUND"
    );
  }

  const rpc =
    await getRpcTransaction(
      txid
    );

  log("RPC_RESULT", rpc);


const expectedAmount =
  Number(withdrawal.amount);

const amountMatch =
  rpc.amount !== null &&
  Math.abs(
    rpc.amount -
    expectedAmount
  ) < 0.00000001;

const expectedSender =
  process.env.PI_MERCHANT_WALLET?.trim() ?? "";

const senderMatch =
  rpc.sender?.toLowerCase() ===
  expectedSender.toLowerCase();

const receiverMatch =
  rpc.receiver?.toLowerCase() ===
  withdrawal.withdraw_wallet.toLowerCase();

const memoMatch =
  !withdrawal.pi_payment_id
    ? true
    : rpc.memo === withdrawal.pi_payment_id;
  if (!rpc.rpcReachable) {
  throw new Error(
    "RPC_UNREACHABLE"
  );
}

if (!rpc.confirmed) {
  throw new Error(
    "TX_NOT_CONFIRMED"
  );
}

if (!amountMatch) {
  throw new Error(
    "AMOUNT_MISMATCH"
  );
}

if (!senderMatch) {
  throw new Error(
    "SENDER_MISMATCH"
  );
}

if (!receiverMatch) {
  throw new Error(
    "RECEIVER_MISMATCH"
  );
}

if (!memoMatch) {
  throw new Error(
    "MEMO_MISMATCH"
  );
}
  await insertA2URpcLog({
  withdrawalId,
  piPaymentId: withdrawal.pi_payment_id,

  txid,

  verified: true,
  stage: "RPC_OK",
  reason: "NONE",

  amount: rpc.amount,
  expectedAmount,

  sender: rpc.sender,
  receiver: rpc.receiver,

  expectedReceiver: withdrawal.withdraw_wallet,
  expectedSender,

  amountMatch,
  receiverMatch,
  senderMatch,

  expectedMemo: withdrawal.pi_payment_id,
  memoMatch,
  memoFound: rpc.memo !== null,

  network: withdrawal.blockchain_network ?? "Pi Testnet",

  verificationVersion: 1,
  verificationMethod: "RPC",

  verificationHash: rpc.hash,

  ledger: rpc.ledger,

  txStatus: rpc.txStatus,
  chainReference: rpc.hash,

  rpcReachable: rpc.rpcReachable,
  confirmed: rpc.confirmed,

  parseLayer: rpc.debug.parseLayer,

  hasMeta: rpc.debug.hasMeta,
  hasEvents: rpc.debug.hasEvents,

  senderFound: rpc.debug.senderFound,
  receiverFound: rpc.debug.receiverFound,
  amountFound: rpc.debug.amountFound,

  feeStroops: null,
  feePi: null,

  latestLedger: null,
  oldestLedger: null,
  applicationOrder: null,

  chainPaymentAmount: null,
  chainEventAmount: null,
  senderBalanceDelta: null,
  receiverBalanceDelta: null,
  chainAmountConsensus: null,

  verificationSnapshot: {
    amountMatch,
    senderMatch,
    receiverMatch,
    memoMatch,
  },

  sourceAccount: rpc.sender,
  memoType: rpc.memo ? "text" : null,

  memo: rpc.memo,
  createdAt: rpc.createdAt,

  payload: rpc.raw,
});
  const verified =
  await getVerifiedRpcByWithdrawalId(
    withdrawalId
  );

console.log(
  "[A2U_RPC_DB] RECEIPT_START",
  withdrawalId
);

await upsertWithdrawalReceipt(
  withdrawalId
);

console.log(
  "[A2U_RPC_DB] RECEIPT_DONE",
  withdrawalId
);

if (!verified) {
  throw new Error(
    "RPC_LOG_NOT_FOUND"
  );
}

return verified;
}
export async function
getRpcVerificationByTxid(
  txid: string
) {
  const result =
    await query(
      `
      SELECT *
      FROM rpc_verification_logs
      WHERE txid = $1
      LIMIT 1
      `,
      [txid]
    );

  return (
    result.rows[0] ??
    null
  );
}

export async function
getRpcVerificationByWithdrawalId(
  withdrawalId: string
) {
  const result =
    await query(
      `
      SELECT *
      FROM rpc_verification_logs
      WHERE withdrawal_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [withdrawalId]
    );

  return (
    result.rows[0] ??
    null
  );
}
export async function getVerifiedRpcByWithdrawalId(
  withdrawalId: string
): Promise<RpcVerificationRow | null> {

  const rs = await query<RpcVerificationRow>(
    `
    SELECT
  withdrawal_id,
  txid,
  ledger,
  sender,
  receiver,
  memo,
  network,
  amount,
  expected_amount,
  amount_match,
  sender_match,
  receiver_match,
  memo_match,
  chain_amount_consensus,
  verified,
  tx_status,
reason,
confirmed,
chain_reference,
verification_hash,
payload,
rpc_reachable,
created_at_chain,
parse_layer,
verification_version,
verification_method,
expected_sender,
expected_receiver,
expected_memo,
memo_found,
source_account,
memo_type,
fee_stroops,
fee_pi,
latest_ledger,
oldest_ledger,
application_order,
  stage
    FROM rpc_verification_logs
    WHERE withdrawal_id = $1
      AND verified = true
      AND stage = 'RPC_OK'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [withdrawalId]
  );

  return rs.rows[0] ?? null;
}
