// =====================================================
// lib/services/wallet.withdraw.history.service.ts
// =====================================================

import {
  getWalletWithdrawHistoryByUser,
  getWalletWithdrawHistoryDetail,
  type WalletWithdrawalHistoryRow,
} from "@/lib/db/wallet/wallet.withdraw.history";

/* =====================================================
   TYPES
===================================================== */

export type WithdrawStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "rejected"
  | "cancelled";

export type WalletWithdrawHistoryItem = {

  id: string;

  amount: number;

  fee: number;

  receive_amount: number;

  currency: string;

  network: string;

  wallet_address: string;

  status: WithdrawStatus;

  tx_hash: string | null;

  admin_note: string | null;

  created_at: string;

  updated_at: string;

  processed_at: string | null;

};

/* =====================================================
   STATUS MAP
===================================================== */

const STATUS_MAP: Record<
  string,
  WithdrawStatus
> = {

  PENDING:
    "pending",

  PROCESSING:
    "processing",

  COMPLETED:
    "completed",

  FAILED:
    "failed",

  REJECTED:
    "rejected",

  CANCELLED:
    "cancelled",

};

function normalizeStatus(
  status: string
): WithdrawStatus {

  return (
    STATUS_MAP[
      status.toUpperCase()
    ] ??
    "pending"
  );

}

/* =====================================================
   MAP
===================================================== */

function mapWithdrawal(
  row: WalletWithdrawalHistoryRow
): WalletWithdrawHistoryItem {

  const amount =
    Number(
      row.amount
    );

  const fee =
    0;

  return {

    id:
      row.id,

    amount,

    fee,

    receive_amount:
      amount - fee,

    currency:
      row.currency,

    network:
      row.blockchain_network ??
      "Pi Network",

    wallet_address:
      row.withdraw_wallet,

    status:
      normalizeStatus(
        row.status
      ),

    tx_hash:
      row.blockchain_txid ??
      row.txid,

    admin_note:
      row.admin_feedback,

    created_at:
      row.requested_at,

    updated_at:
      row.completed_at ??
      row.requested_at,

    processed_at:
      row.completed_at,

  };

}

/* =====================================================
   GET HISTORY
===================================================== */

export async function getUserWithdrawHistory(
  userId: string
): Promise<
  WalletWithdrawHistoryItem[]
> {

  const rows =
    await getWalletWithdrawHistoryByUser(
      userId
    );

  return rows.map(
    mapWithdrawal
  );

}

/* =====================================================
   GET DETAIL
===================================================== */

export async function getUserWithdrawHistoryDetail(
  withdrawalId: string,
  userId: string
): Promise<
  WalletWithdrawHistoryItem | null
> {

  const row =
    await getWalletWithdrawHistoryDetail(
      withdrawalId,
      userId
    );

  if (!row) {

    return null;

  }

  return mapWithdrawal(
    row
  );

}
