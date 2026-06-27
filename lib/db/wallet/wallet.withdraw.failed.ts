// =====================================================
// lib/db/wallet/wallet.withdraw.failed.ts
// =====================================================

import {
  createHash,
} from "crypto";

import {
  withTransaction,
} from "@/lib/db";

import {
  releaseReservedBalance,
} from "./wallet.balance";

import {
  createWalletJournal,
} from "./wallet.journal";

import {
  createWithdrawalSettlementEventOnce,
  WithdrawalSettlementEvents,
} from "@/lib/db/settlement/settlement.event.a2u";

/* =====================================================
   LOG
===================================================== */

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
   FAIL WITHDRAWAL
===================================================== */

export async function markWithdrawalFailed(
  withdrawalId: string,
  reason: string
): Promise<void> {

  vlog(
    "MARK_FAILED_START",
    {
      withdrawalId,
      reason,
    }
  );

  await withTransaction(
    async (client) => {

      /* ===============================================
         LOAD WITHDRAWAL
      =============================================== */

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
          [
            withdrawalId,
          ]
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

      vlog(
        "WITHDRAWAL_ROW",
        withdrawal
      );

      /* ===============================================
         RELEASE RESERVED
      =============================================== */

      await releaseReservedBalance(
        withdrawal.user_id,
        Number(
          withdrawal.amount
        ),
        client
      );

      await createWithdrawalSettlementEventOnce(
        {
          withdrawalId,

          eventType:
            WithdrawalSettlementEvents.BALANCE_RELEASED,

          source:
            "wallet.balance",

          reason:
            "Reserved balance released",

          metadata: {},
        },
        client
      );

      /* ===============================================
         JOURNAL
      =============================================== */

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
          Number(
            withdrawal.amount
          ),

        note:
          "Withdraw reverted",

        metadata: {

          stage:
            "FAILED",

          reason,

        },

        eventHash:
          createHash("sha256")
            .update(
              `${withdrawalId}:WITHDRAW_FAILED`
            )
            .digest("hex"),

      });

      await createWithdrawalSettlementEventOnce(
        {
          withdrawalId,

          eventType:
            WithdrawalSettlementEvents.JOURNAL_REVERTED,

          source:
            "wallet.journal",

          reason:
            "Withdraw journal reverted",

          metadata: {},
        },
        client
      );

      /* ===============================================
         UPDATE WITHDRAWAL
      =============================================== */

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

      vlog(
        "UPDATE_RESULT",
        {
          rowCount:
            rs.rowCount,
        }
      );

      if (
        rs.rowCount !== 1
      ) {
        throw new Error(
          "WITHDRAWAL_FAIL_UPDATE_FAILED"
        );
      }

      await createWithdrawalSettlementEventOnce(
        {
          withdrawalId,

          eventType:
            WithdrawalSettlementEvents.WITHDRAW_FAILED,

          source:
            "wallet.withdraw",

          reason,

          metadata: {},
        },
        client
      );

      vlog(
        "MARK_FAILED_DONE",
        {
          withdrawalId,
        }
      );
    }
  );
}
