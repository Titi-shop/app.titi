// =====================================================
// lib/db/wallet/wallet.withdraw.history.ts
// =====================================================

import {
  query,
} from "@/lib/db";

import {
  logger,
} from "@/lib/logger";

/* =====================================================
   TYPES
===================================================== */

export type WalletWithdrawalHistoryRow = {

  id: string;

  user_id: string;

  amount: string;

  currency: string;

  withdraw_wallet: string;

  status: string;

  requested_at: string;

  completed_at: string | null;

  fail_reason: string | null;

  approved_by: string | null;

  approved_at: string | null;

  txid: string | null;

  blockchain_txid: string | null;

  blockchain_network: string | null;

  blockchain_ledger: number | null;

  blockchain_memo: string | null;

  blockchain_fee: string | null;

  blockchain_from_address: string | null;

  blockchain_to_address: string | null;

  pi_payment_id: string | null;

  pi_payment_memo: string | null;

  paid_at: string | null;

  admin_feedback: string | null;

  retry_count: number | null;

  wallet_address_id: string | null;

  pi_uid: string | null;

};

/* =====================================================
   GET USER HISTORY
===================================================== */

export async function getWalletWithdrawHistoryByUser(

  userId: string

): Promise<WalletWithdrawalHistoryRow[]> {

  logger.debug(
  "WALLET_WITHDRAW_HISTORY.LIST_START"
);

  const rs =
    await query<WalletWithdrawalHistoryRow>(
      `
      SELECT
        *
      FROM wallet_withdrawals
      WHERE user_id = $1
      ORDER BY requested_at DESC
      `,
      [
        userId,
      ]
    );

  logger.debug(
  "WALLET_WITHDRAW_HISTORY.LIST_DONE"
);

  return rs.rows;

}

/* =====================================================
   GET DETAIL
===================================================== */

export async function getWalletWithdrawHistoryDetail(

  withdrawalId: string,

  userId: string

): Promise<
  WalletWithdrawalHistoryRow | null
> {

  logger.debug(
  "WALLET_WITHDRAW_HISTORY.DETAIL_START"
);

  const rs =
    await query<WalletWithdrawalHistoryRow>(
      `
      SELECT
        *
      FROM wallet_withdrawals
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [
        withdrawalId,
        userId,
      ]
    );

  logger.debug(
  "WALLET_WITHDRAW_HISTORY.DETAIL_DONE"
);

  return (
    rs.rows[0] ??
    null
  );

}

/* =====================================================
   GET BY STATUS
===================================================== */

export async function getWalletWithdrawHistoryByStatus(

  userId: string,

  status: string

): Promise<
  WalletWithdrawalHistoryRow[]
> {

  logger.debug(
  "WALLET_WITHDRAW_HISTORY.STATUS_START"
);

  const rs =
    await query<WalletWithdrawalHistoryRow>(
      `
      SELECT
        *
      FROM wallet_withdrawals
      WHERE user_id = $1
        AND status = $2
      ORDER BY requested_at DESC
      `,
      [
        userId,
        status,
      ]
    );

  logger.debug(
  "WALLET_WITHDRAW_HISTORY.STATUS_DONE"
);

  return rs.rows;

}
