import type {
  RpcVerifyStage,
  RpcVerifyReason,
} from "./rpc.types";

export type InsertRpcLogInput = {
  paymentIntentId: string;
  piPaymentId: string | null;

  rpcReachable: boolean;

  parseLayer: string | null;

  hasMeta: boolean;
  hasEvents: boolean;

  senderFound: boolean;
  receiverFound: boolean;
  amountFound: boolean;

  txid: string;
  verified: boolean;

  stage: RpcVerifyStage;
  reason: RpcVerifyReason | null;

  amount: number | null;
  expectedAmount: number | null;

  sender: string | null;
  receiver: string | null;
  expectedReceiver: string | null;

  amountMatch: boolean;
  receiverMatch: boolean;
  senderMatch: boolean;

  mismatchReason: string | null;
  fraudReason: string | null;

  verificationHash: string | null;

  ledger: number | null;

  txStatus: string | null;
  chainReference: string | null;

  payload: unknown;

  createdAt: string | null;

  memo: string | null;
  successful: boolean;
operationCount: number | null;

feeStroops: number | null;
feePi: number | null;

latestLedger: number | null;
oldestLedger: number | null;
applicationOrder: number | null;

sourceAccount: string | null;
memoType: string | null;

network: string | null;

expectedSender: string | null;
expectedMemo: string | null;

memoMatch: boolean | null;
memoFound: boolean | null;

verificationVersion: number | null;
verificationMethod: string | null;

verificationSnapshot: unknown;

chainPaymentAmount: number | null;
chainEventAmount: number | null;

senderBalanceDelta: number | null;
receiverBalanceDelta: number | null;

chainAmountConsensus: boolean | null;
};
