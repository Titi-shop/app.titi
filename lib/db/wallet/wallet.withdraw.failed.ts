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

import {
  logger,
} from "@/lib/logger";
/* =====================================================
   FAIL WITHDRAWAL
===================================================== */

export async function markWithdrawalFailed(
  withdrawalId: string,
  reason: string
): Promise<void> {

  logger.info(
  "WALLET_WITHDRAW.FAIL_START"
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

      logger.debug(
  "WALLET_WITHDRAW.LOADED"
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
logger.debug(
  "WALLET_WITHDRAW.RESERVE_RELEASED"
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
logger.debug(
  "WALLET_WITHDRAW.JOURNAL_REVERTED"
);
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

      logger.debug(
  "WALLET_WITHDRAW.STATUS_UPDATED"
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

      logger.info(
  "WALLET_WITHDRAW.FAIL_DONE"
);
    }
  );
}
