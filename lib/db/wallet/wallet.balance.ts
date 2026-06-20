// =====================================================
// lib/db/wallet/wallet.balance.ts
// =====================================================
import {
  query,
  withTransaction,
} from "@/lib/db";
import {
  ensureWallet,
} from "./wallet.ensure";
import type {
  WalletRow,
  WalletClient,
  CreditWalletInput,
  DebitWalletInput,
} from "./wallet.types";
/* =====================================================
   HELPERS
===================================================== */
function getDb(
  client?: WalletClient
) {
  return client ?? { query };
}
function toNumberSafe(
  value: unknown,
  field: string
): number {
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new Error(
      `INVALID_NUMBER_${field}`
    );
  }
  return n;
}
/* =====================================================
   GET WALLET
===================================================== */
export async function getWalletByUserId(
  userId: string,
  client?: WalletClient
) {
  const db =
    getDb(client);
  await ensureWallet(
    userId,
    client
  );
  const { rows } =
    await db.query<WalletRow>(
      `
      SELECT
        balance,
        available_balance,
        pending_balance,
        frozen_balance
      FROM wallets
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );
  const wallet =
    rows[0];
  return {
    balance:
      toNumberSafe(
        wallet?.balance ?? 0,
        "balance"
      ),
    availableBalance:
      toNumberSafe(
        wallet?.available_balance ?? 0,
        "available_balance"
      ),
    pendingBalance:
      toNumberSafe(
        wallet?.pending_balance ?? 0,
        "pending_balance"
      ),
    frozenBalance:
      toNumberSafe(
        wallet?.frozen_balance ?? 0,
        "frozen_balance"
      ),
  };
}
/* =====================================================
   CREDIT WALLET
===================================================== */
export async function creditWallet(
  params: CreditWalletInput
) {
  if (
    params.amount <= 0
  ) {
    throw new Error(
      "INVALID_AMOUNT"
    );
  }
  /* ===============================================
     EXTERNAL TRANSACTION
  =============================================== */
  if (params.client) {
    await ensureWallet(
      params.userId,
      params.client
    );
    await params.client.query(
      `
      UPDATE wallets
      SET
        balance =
          balance + $1,
        available_balance =
          available_balance + $1,
        wallet_version =
          wallet_version + 1,
        last_credit_at =
          NOW(),
        updated_at =
          NOW()
      WHERE user_id = $2
      `,
      [
        params.amount,
        params.userId,
      ]
    );
    return;
  }
  /* ===============================================
     INTERNAL TRANSACTION
  =============================================== */
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
          balance =
            balance + $1,
          available_balance =
            available_balance + $1,
          wallet_version =
            wallet_version + 1,
          last_credit_at =
            NOW(),
          updated_at =
            NOW()
        WHERE user_id = $2
        `,
        [
          params.amount,
          params.userId,
        ]
      );
    }
    if (rs.rowCount !== 1) {
  throw new Error(
    "WALLET_CREDIT_FAILED"

  );

}
  );
}
/* =====================================================
   DEBIT WALLET
===================================================== */
export async function debitWallet(
  params: DebitWalletInput
) {
  if (
    params.amount <= 0
  ) {
    throw new Error(
      "INVALID_AMOUNT"
    );
  }
  /* ===============================================
     EXTERNAL TRANSACTION
  =============================================== */
  if (params.client) {
    const { rows } =
      await params.client.query<WalletRow>(
        `
        SELECT
  balance,
  available_balance
        FROM wallets
        WHERE user_id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [params.userId]
      );
    if (!rows.length) {
      throw new Error(
        "WALLET_NOT_FOUND"
      );
    }
    const available =
  toNumberSafe(
    rows[0].available_balance,
    "available_balance"
  );

if (
  available < params.amount
) {
  throw new Error(
    "INSUFFICIENT_AVAILABLE_BALANCE"
  );
}
    const balance =
      toNumberSafe(
        rows[0].balance,
        "balance"
      );
    if (
      balance < params.amount
    ) {
      throw new Error(
        "INSUFFICIENT_BALANCE"
      );
    }
    await params.client.query(
      `
      UPDATE wallets
SET
  balance = balance - $1,
  available_balance = available_balance - $1,
  wallet_version = wallet_version + 1,
  updated_at = NOW()
WHERE user_id = $2
  AND available_balance >= $1
      `,
      [
        params.amount,
        params.userId,
      ]
    );
    return;
  }
  /* ===============================================
     INTERNAL TRANSACTION
  =============================================== */
  return withTransaction(
    async (client) => {
      await debitWallet({
        ...params,
        client,
      });
    }
  );
}
