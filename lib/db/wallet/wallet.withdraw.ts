
// =====================================================
// lib/db/wallet/wallet.withdraw.ts
// =====================================================

import {
  randomUUID,
  createHash,
} from "crypto";

import {
  query,
  withTransaction,
} from "@/lib/db";

import {
  reserveWalletBalance,
  releaseReservedBalance,
  finalizeReservedBalance,
} from "./wallet.balance";

import {
  createWalletJournal,
} from "./wallet.journal";
import {
  getVerifiedRpcByWithdrawalId,
} from "@/lib/db/payments.rpc.a2u";
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

  pi_payment_id: string | null;
  blockchain_txid: string | null;

  blockchain_ledger: number | null;
  blockchain_memo: string | null;
  blockchain_fee: string | null;
  pi_payment_memo: string | null;
blockchain_from_address: string | null;
blockchain_to_address: string | null;
blockchain_network: string | null;
pi_uid: string | null;
  paid_at: string | null;
  completed_at: string | null;
  fail_reason: string | null;
  retry_count: number | null;
  settlement_ready: boolean;
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
  *
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

  await withTransaction(
    async (client) => {

      const withdrawalRs =
        await client.query<{
          user_id: string;
          amount: string;
          status: string;
        }>(
          `
          SELECT
            user_id,
            amount,
            status
          FROM wallet_withdrawals
          WHERE id = $1
          FOR UPDATE
          `,
          [withdrawalId]
        );

      if (
        withdrawalRs.rowCount !== 1
      ) {
        throw new Error(
          "WITHDRAWAL_NOT_FOUND"
        );
      }

      const withdrawal =
        withdrawalRs.rows[0];

      if (
        withdrawal.status !==
        "PENDING"
      ) {
        throw new Error(
          "INVALID_STATUS"
        );
      }

      await reserveWalletBalance(
        withdrawal.user_id,
        Number(
          withdrawal.amount
        ),
        client
      );
await createWalletJournal({
  ownerId: withdrawal.user_id,
  ownerType: "SELLER",

  refId: withdrawalId,
  refTable: "wallet_withdrawals",

  entryType: "SELLER_WITHDRAW",
  direction: "DEBIT",

  amount: Number(withdrawal.amount),

  note: "Withdraw reserved",

  metadata: {
    stage: "APPROVED",
  },

  eventHash: createHash("sha256")
    .update(
      `${withdrawalId}:WITHDRAW_RESERVED`
    )
    .digest("hex"),

  client,
});
      const rs =
        await client.query(
          `
          UPDATE wallet_withdrawals
          SET
            status = 'APPROVED',
            approved_by = $2,
            approved_at = NOW()
          WHERE id = $1
          `,
          [
            withdrawalId,
            adminId,
          ]
        );

      if (
        rs.rowCount !== 1
      ) {
        throw new Error(
          "WITHDRAWAL_APPROVE_FAILED"
        );
      }
    }
  );
}
export async function markWithdrawalProcessing(
  withdrawalId: string,
  piPaymentId: string,
  piPaymentMemo?: string,
  piUid?: string,
  blockchainNetwork?: string
): Promise<void> {
  vlog("MARK_PROCESSING_START", {
    withdrawalId,
    piPaymentId,
  });

  const rs = await query(
  `
  UPDATE wallet_withdrawals
  SET
  status = 'PROCESSING',
  pi_payment_id = $2,
  pi_uid = $3,
  pi_payment_memo = $4
  WHERE id = $1
    AND status = 'APPROVED'
  `,
  [
  withdrawalId,
  piPaymentId,
  piUid,
  piPaymentMemo,
]
);

  vlog("MARK_PROCESSING_RESULT", {
    rowCount: rs.rowCount,
  });

  if (rs.rowCount !== 1) {
    throw new Error(
      "WITHDRAWAL_PROCESSING_FAILED"
    );
  }
}
export async function markWithdrawalCompleted(
  withdrawalId: string
): Promise<void> {

  vlog("MARK_COMPLETED_START", {
  withdrawalId,
});

  await withTransaction(
    async (client) => {

      const withdrawalRs =
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

      if (
        withdrawalRs.rowCount !== 1
      ) {
        throw new Error(
          "WITHDRAWAL_NOT_FOUND"
        );
      }

      const withdrawal =
        withdrawalRs.rows[0];
const rpc =
  await getVerifiedRpcByWithdrawalId(
    withdrawalId
  );

if (!rpc) {
  throw new Error(
    "RPC_LOG_NOT_FOUND"
  );
}

      await finalizeReservedBalance(
        withdrawal.user_id,
        Number(
          withdrawal.amount
        ),
        client
      );
await createWalletJournal({
  ownerId: withdrawal.user_id,
  ownerType: "SELLER",

  refId: withdrawalId,
  refTable: "wallet_withdrawals",

  entryType: "SELLER_WITHDRAW",
  direction: "DEBIT",
  amount: Number(withdrawal.amount),
  note: "Withdraw completed",
  metadata: {
    txid: rpc.txid,
    ledger: rpc.ledger,
},

  eventHash: createHash("sha256")
    .update(
      `${withdrawalId}:WITHDRAW_COMPLETED`
    )
    .digest("hex"),

  client,
});
      const rs =
        await client.query(
          `
          UPDATE wallet_withdrawals
          SET
            status = 'COMPLETED',

blockchain_txid = $2,
txid = $2,

blockchain_ledger = $3,
blockchain_memo = $4,
blockchain_fee = $5,
blockchain_from_address = $6,
blockchain_to_address = $7,
blockchain_network = $8,

            paid_at = NOW(),
            completed_at = NOW()

          WHERE id = $1
            AND status = 'PROCESSING'
          `,
          [
            withdrawalId,
            rpc.txid,
rpc.ledger,
rpc.memo,
      null,
rpc.sender,
rpc.receiver,
rpc.network,
          ]
        );

      if (
        rs.rowCount !== 1
      ) {
        throw new Error(
          "WITHDRAWAL_COMPLETE_FAILED"
        );
      }
    }
  );

  
}
export async function markWithdrawalFailed(
  withdrawalId: string,
  reason: string
): Promise<void> {

  await withTransaction(
    async (client) => {

      const withdrawalRs =
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

      if (
        withdrawalRs.rowCount !== 1
      ) {
        throw new Error(
          "WITHDRAWAL_NOT_FOUND"
        );
      }

      const withdrawal =
        withdrawalRs.rows[0];

      await releaseReservedBalance(
        withdrawal.user_id,
        Number(
          withdrawal.amount
        ),
        client
      );
await createWalletJournal({
  client,

  ownerId:
    withdrawal.user_id,

  ownerType:
    "SELLER",

  refId:
    withdrawalId,

  refTable:
    "wallet_withdrawals",

  entryType:
    "SELLER_WITHDRAW_REVERT",

  direction:
    "CREDIT",

  amount:
    Number(withdrawal.amount),

  note:
    "Withdraw reverted",
  eventHash: createHash("sha256")
  .update(
    `${withdrawalId}:WITHDRAW_FAILED`
  )
  .digest("hex"),

  metadata: {
    stage: "FAILED",
  },
});
      const rs =
        await client.query(
          `
          UPDATE wallet_withdrawals
          SET
            status = 'FAILED',
            fail_reason = $2,
            retry_count =
              COALESCE(
                retry_count,
                0
              ) + 1
          WHERE id = $1
          `,
          [
            withdrawalId,
            reason,
          ]
        );

      if (
        rs.rowCount !== 1
      ) {
        throw new Error(
          "WITHDRAWAL_FAIL_UPDATE_FAILED"
        );
      }
    }
  );
  vlog(
  "MARK_COMPLETED_DONE",
  {
    withdrawalId,
    txid: rpc.txid,
  }
);
}
export async function getWalletWithdrawalById(
  withdrawalId: string
): Promise<WalletWithdrawalRow | null> {
  vlog(
    "GET_WITHDRAWAL_START",
    withdrawalId
  );

  const rs =
  await query<WalletWithdrawalRow>(
    `
    SELECT *
    FROM wallet_withdrawals
    WHERE id = $1
    LIMIT 1
    `,
    [withdrawalId]
  );

  vlog(
    "GET_WITHDRAWAL_RESULT",
    {
      found:
        rs.rows.length > 0,
    }
  );

  return rs.rows[0] ?? null;
}
export async function getWithdrawalByPaymentId(
  piPaymentId: string
): Promise<WalletWithdrawalRow | null> {

  const rs =
    await query<WalletWithdrawalRow>(
      `
      SELECT
        *
      FROM wallet_withdrawals
      WHERE pi_payment_id = $1
      LIMIT 1
      `,
      [piPaymentId]
    );

  return rs.rows[0] ?? null;
}
export async function getProcessingWithdrawals(): Promise<
  WalletWithdrawalRow[]
> {
  vlog(
    "GET_PROCESSING_START"
  );

  const rs =
    await query<WalletWithdrawalRow>(
      `
      SELECT
        *
      FROM wallet_withdrawals
      WHERE status = 'PROCESSING'
      ORDER BY requested_at ASC
      `
    );

  vlog(
    "GET_PROCESSING_DONE",
    {
      count:
        rs.rows.length,
    }
  );

  return rs.rows;
}
export async function retryWithdrawal(
  withdrawalId: string
): Promise<void> {
  console.log(
    "[WALLET_WITHDRAW][RETRY_START]",
    withdrawalId
  );

  const result =
    await query(
      `
      UPDATE wallet_withdrawals
      SET
        status = 'APPROVED',
        fail_reason = NULL,
        pi_payment_id = NULL,
        blockchain_txid = NULL,
        paid_at = NULL,
        completed_at = NULL,
        blockchain_ledger = NULL,
blockchain_memo = NULL,
blockchain_fee = NULL,
blockchain_from_address = NULL,
blockchain_to_address = NULL,
blockchain_network = NULL,
pi_payment_memo = NULL
      WHERE id = $1
      AND status = 'FAILED'
      `,
      [withdrawalId]
    );

  console.log(
    "[WALLET_WITHDRAW][RETRY_RESULT]",
    {
      rowCount:
        result.rowCount,
    }
  );

  if (
    result.rowCount !== 1
  ) {
    throw new Error(
      "WITHDRAWAL_RETRY_FAILED"
    );
  }
}
