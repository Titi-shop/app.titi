import { query } from "@/lib/db";

import {
  getWalletWithdrawalById,
  getWithdrawalByPaymentId,
} from "@/lib/db/wallet/wallet.withdraw";

import {
  getRpcVerificationByWithdrawalId,
  getRpcVerificationByTxid,
} from "@/lib/db/payments.rpc.a2u";

/* =====================================================
   TYPES
===================================================== */

export type UpsertWithdrawalReceiptInput = {
  withdrawalId: string;
};

type ReceiptRow = {
  id: string;

  payment_intent_id: string | null;

  withdrawal_id: string | null;

  user_id: string | null;

  order_id: string | null;

  escrow_id: string | null;

  seller_credit_id: string | null;

  receipt_type: string;

  direction: string;

  pi_payment_id: string;

  pi_uid: string | null;

  txid: string | null;

  expected_amount: string;

  verified_amount: string;

  currency: string;

  sender_wallet: string | null;

  receiver_wallet: string | null;

  verification_status: string;

  verify_source: string;

  rpc_confirmed: boolean;

  rpc_ledger: number | null;

  chain_reference: string | null;

  tx_status: string | null;

  pi_payload: unknown;

  rpc_payload: unknown;

  merged_payload: unknown;

  forensic_hash: string | null;

  idempotency_key: string | null;

  failure_reason: string | null;

  manual_note: string | null;

  verified_at: Date | null;

  completed_at: Date | null;

  settlement_state: string | null;

  developer_completed: boolean;

  developer_completed_at: Date | null;

  pi_created_at: string | null;

  pi_memo: string | null;

  rpc_tx_status: string | null;

  rpc_stage: string | null;

  rpc_reason: string | null;

  receipt_version: number;

  created_at: Date;

  updated_at: Date;
};

/* =====================================================
   LOGGER
===================================================== */

function receiptLog(
  step: string,
  payload?: unknown
): void {
  console.log(
    `[A2U_RECEIPT] ${step}`,
    payload ?? ""
  );
}

function receiptError(
  step: string,
  payload?: unknown
): void {
  console.error(
    `[A2U_RECEIPT][ERROR] ${step}`,
    payload ?? ""
  );
}
