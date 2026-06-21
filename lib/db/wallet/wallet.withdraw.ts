
// =====================================================
// lib/db/wallet/wallet.withdraw.ts
// =====================================================

import {
  randomUUID,
} from "crypto";

import {
  query,
  withTransaction,
} from "@/lib/db";

import {
  debitWallet,
} from "./wallet.balance";

import {
  createWalletJournal,
} from "./wallet.journal";

import type {
  WalletClient,
} from "./wallet.types";
function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[WALLET_WITHDRAW][${step}]`,
    data ?? ""
  );
}
/* =====================================================
   TYPES
===================================================== */

type CreateWalletWithdrawalInput =
  {
    userId: string;
    amount: number;
    withdrawWallet: string;
  };

type WithdrawalRow = {
  id: string;
};
type WalletWithdrawalRow = {
  id: string;
  user_id: string;
  amount: string;
  currency: string;
  withdraw_wallet: string;
  status: string;
  requested_at: string;
};


/* =====================================================
   CREATE WITHDRAWAL
===================================================== */

export async function createWalletWithdrawal(
  params: CreateWalletWithdrawalInput
): Promise<WithdrawalRow> {

  /* ===================================================
     VALIDATE
  =================================================== */

  if (
    typeof params.userId !==
      "string" ||
    !params.userId
  ) {
    throw new Error(
      "INVALID_USER_ID"
    );
  }

  if (
  Number.isNaN(params.amount) ||
  params.amount <= 0 ||
  params.amount > 1000000
) {
  throw new Error(
    "INVALID_AMOUNT"
  );
}

  if (
    typeof params.withdrawWallet !==
      "string" ||
    !params.withdrawWallet.trim()
  ) {
    throw new Error(
      "INVALID_WITHDRAW_WALLET"
    );
  }

  /* ===================================================
     TX
  =================================================== */

  return withTransaction(
    async (
      client
    ) => {

      const withdrawalId =
        randomUUID();
      /* ===============================================
         INSERT WITHDRAWAL
      =============================================== */

      const withdrawRs =
  await client.query(
    `
    INSERT INTO wallet_withdrawals (
      id,
      user_id,
      amount,
      currency,
      withdraw_wallet,
      status,
      requested_at
    )
    VALUES (
      $1,$2,$3,
      'PI',
      $4,
      'PENDING',
      NOW()
    )
    RETURNING id
    `,
    [
      withdrawalId,
      params.userId,
      params.amount,
      params.withdrawWallet,
    ]
  );

if (withdrawRs.rowCount !== 1) {
  throw new Error(
    "WITHDRAWAL_CREATE_FAILED"
  );
}
      
      /* ===============================================
         DONE
      =============================================== */

      return {
        id:
          withdrawalId,
      };
    }
  );
}

export async function getWalletWithdrawals(): Promise<
  WalletWithdrawalRow[]
> {
  vlog("LIST_START");

  const rs =
    await query<WalletWithdrawalRow>(
      `
      SELECT
        id,
        user_id,
        amount,
        currency,
        withdraw_wallet,
        status,
        requested_at
      FROM wallet_withdrawals
      ORDER BY requested_at DESC
      `
    );

  vlog("LIST_DONE", {
    count:
      rs.rows.length,
  });

  if (rs.rows.length) {
    vlog(
      "FIRST_ROW",
      rs.rows[0]
    );
  }

  return rs.rows;
}
export async function approveWalletWithdrawal(
  withdrawalId: string,
  adminId: string
): Promise<void> {
  const rs = await query(
    `
    UPDATE wallet_withdrawals
    SET
      status = 'APPROVED',
      approved_by = $2,
      approved_at = NOW()
    WHERE id = $1
      AND status = 'PENDING'
    `,
    [
      withdrawalId,
      adminId,
    ]
  );

  if (rs.rowCount !== 1) {
    throw new Error(
      "WITHDRAWAL_NOT_FOUND"
    );
  }
}
