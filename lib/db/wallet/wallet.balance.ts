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
  const db = getDb(client);

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

  const wallet = rows[0];

  return {
    balance: toNumberSafe(
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
  if (params.amount <= 0) {
    throw new Error(
      "INVALID_AMOUNT"
    );
  }

  /* ===============================================
     EXTERNAL TX
  =============================================== */

  if (params.client) {
    await ensureWallet(
      params.userId,
      params.client
    );

    const rs =
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

    if (rs.rowCount !== 1) {
      throw new Error(
        "WALLET_CREDIT_FAILED"
      );
    }

    return;
  }

  /* ===============================================
     INTERNAL TX
  =============================================== */

  return withTransaction(
    async (client) => {
      await creditWallet({
        ...params,
        client,
      });
    }
  );
}

/* =====================================================
   DEBIT WALLET
===================================================== */

export async function debitWallet(
  params: DebitWalletInput
) {
  if (params.amount <= 0) {
    throw new Error(
      "INVALID_AMOUNT"
    );
  }

  /* ===============================================
     EXTERNAL TX
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

    const balance =
      toNumberSafe(
        rows[0].balance,
        "balance"
      );

    const available =
      toNumberSafe(
        rows[0].available_balance,
        "available_balance"
      );

    if (
      available <
      params.amount
    ) {
      throw new Error(
        "INSUFFICIENT_AVAILABLE_BALANCE"
      );
    }

    if (
      balance <
      params.amount
    ) {
      throw new Error(
        "INSUFFICIENT_BALANCE"
      );
    }

    const rs =
      await params.client.query(
        `
        UPDATE wallets
        SET
          balance =
            balance - $1,

          available_balance =
            available_balance - $1,

          wallet_version =
            wallet_version + 1,

          updated_at =
            NOW()

        WHERE user_id = $2
          AND available_balance >= $1
        `,
        [
          params.amount,
          params.userId,
        ]
      );

    if (rs.rowCount !== 1) {
      throw new Error(
        "WALLET_DEBIT_FAILED"
      );
    }

    return;
  }

  /* ===============================================
     INTERNAL TX
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
export async function reserveWalletBalance(
  userId: string,
  amount: number,
  client?: WalletClient
) {
  if (amount <= 0) {
    throw new Error(
      "INVALID_AMOUNT"
    );
  }

  if (client) {
    const { rows } =
      await client.query<WalletRow>(
        `
        SELECT
          available_balance,
          pending_balance
        FROM wallets
        WHERE user_id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [userId]
      );

    if (!rows.length) {
      throw new Error(
        "WALLET_NOT_FOUND"
      );
    }

    const available =
      toNumberSafe(
        rows[0]
          .available_balance,
        "available_balance"
      );

    if (available < amount) {
      throw new Error(
        "INSUFFICIENT_AVAILABLE_BALANCE"
      );
    }

    const rs =
      await client.query(
        `
        UPDATE wallets
        SET
          available_balance =
            available_balance - $1,

          pending_balance =
            pending_balance + $1,

          wallet_version =
            wallet_version + 1,

          updated_at =
            NOW()

        WHERE user_id = $2
        `,
        [
          amount,
          userId,
        ]
      );

    if (rs.rowCount !== 1) {
      throw new Error(
        "WALLET_RESERVE_FAILED"
      );
    }

    return;
  }

  return withTransaction(
    async (tx) => {
      await reserveWalletBalance(
        userId,
        amount,
        tx
      );
    }
  );
}
export async function releaseReservedBalance(
  userId: string,
  amount: number,
  client?: WalletClient
) {
  if (amount <= 0) {
    throw new Error(
      "INVALID_AMOUNT"
    );
  }

  if (client) {
    const rs =
      await client.query(
        `
        UPDATE wallets
        SET
          available_balance =
            available_balance + $1,

          pending_balance =
            pending_balance - $1,

          wallet_version =
            wallet_version + 1,

          updated_at =
            NOW()

        WHERE user_id = $2
          AND pending_balance >= $1
        `,
        [
          amount,
          userId,
        ]
      );

    if (rs.rowCount !== 1) {
      throw new Error(
        "WALLET_RELEASE_FAILED"
      );
    }

    return;
  }

  return withTransaction(
    async (tx) => {
      await releaseReservedBalance(
        userId,
        amount,
        tx
      );
    }
  );
}
export async function finalizeReservedBalance(
  userId: string,
  amount: number,
  client?: WalletClient
) {
  if (amount <= 0) {
    throw new Error(
      "INVALID_AMOUNT"
    );
  }

  if (client) {
    const rs =
      await client.query(
        `
        UPDATE wallets
        SET
          balance =
            balance - $1,

          pending_balance =
            pending_balance - $1,

          wallet_version =
            wallet_version + 1,

          last_debit_at =
            NOW(),

          updated_at =
            NOW()

        WHERE user_id = $2
          AND pending_balance >= $1
        `,
        [
          amount,
          userId,
        ]
      );

    if (rs.rowCount !== 1) {
      throw new Error(
        "WALLET_FINALIZE_FAILED"
      );
    }

    return;
  }

  return withTransaction(
    async (tx) => {
      await finalizeReservedBalance(
        userId,
        amount,
        tx
      );
    }
  );
}
export async function getWalletRecordByUserId(
  userId: string,
  client?: WalletClient
) {
  const db = getDb(client);

  await ensureWallet(userId, client);

  const { rows } =
    await db.query(
      `
      SELECT *
      FROM wallets
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );

  return rows[0] ?? null;
}
export async function markWithdrawalFailed(
  withdrawalId: string,
  reason: string
): Promise<void> {

  vlog("MARK_FAILED_START", {
    withdrawalId,
    reason,
  });

  await withTransaction(async (client) => {

    const rs =
      await client.query<{
        user_id: string;
        amount: string;
      }>(
        `
        SELECT
          user_id,
          amount
        FROM wallet_withdrawals
        WHERE id = $1
        FOR UPDATE
        `,
        [withdrawalId]
      );

    if (rs.rowCount !== 1) {
      throw new Error(
        "WITHDRAWAL_NOT_FOUND"
      );
    }

    const row = rs.rows[0];

    await releaseReservedBalance(
      row.user_id,
      Number(row.amount),
      client
    );

    const updateRs =
      await client.query(
        `
        UPDATE wallet_withdrawals

        SET
          status = 'FAILED',
          fail_reason = $2,
          updated_at = NOW()

        WHERE id = $1
          AND status = 'PROCESSING'
        `,
        [
          withdrawalId,
          reason,
        ]
      );

    if (updateRs.rowCount !== 1) {
      throw new Error(
        "WITHDRAWAL_FAIL_UPDATE_FAILED"
      );
    }

  });

  vlog("MARK_FAILED_DONE", {
    withdrawalId,
  });
}
