// =====================================================
// lib/db/wallet/wallet.withdraw.ts
// =====================================================

import {
  randomUUID,
} from "crypto";

import {
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
const withdrawWallet =
  params.withdrawWallet
    .trim()
    .toLowerCase();
  /* ===================================================
     TX
  =================================================== */

  return withTransaction(
  async (client) => {
    await ensureWallet(
      params.userId,
      client
    );

    const rs =
      await client.query(
        `
        UPDATE wallets
        SET
          balance = balance + $1,
          available_balance = available_balance + $1,
          wallet_version = wallet_version + 1,
          last_credit_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $2
        `,
        [
          params.amount,
          params.userId,
        ]
      );

    if (rs.rowCount !== 1) {
      throw new Error(
        "WALLET_CREDIT_FAILED"
      );
    }
  }
);
          

      /* ===============================================
         JOURNAL
      =============================================== */

      await createWalletJournal({
        client:
          client as WalletClient,

        ownerId:
          params.userId,

        ownerType:
          "SELLER",

        refId:
          withdrawalId,

        refTable:
          "wallet_withdrawals",

        entryType:
          "SELLER_WITHDRAW",

        direction:
          "DEBIT",

        amount:
          params.amount,

        note:
          "Wallet withdrawal request",
      });

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
