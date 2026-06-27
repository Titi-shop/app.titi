// =====================================================
// lib/db/wallet/wallet.withdraw.retry.ts
// =====================================================

import {
  query,
} from "@/lib/db";

import {
  createWithdrawalSettlementEventOnce,
  WithdrawalSettlementEvents,
} from "@/lib/db/settlement/settlement.event.a2u";

function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[WALLET_WITHDRAW][${step}]`,
    data ?? ""
  );
}

export async function retryWithdrawal(
  withdrawalId: string
): Promise<void> {

  vlog(
    "RETRY_START",
    {
      withdrawalId,
    }
  );

  const result =
    await query(
      `
      UPDATE wallet_withdrawals
      SET

        status = 'APPROVED',

        fail_reason = NULL,

        pi_payment_id = NULL,
        pi_uid = NULL,
        pi_payment_memo = NULL,

        blockchain_txid = NULL,
        txid = NULL,

        blockchain_ledger = NULL,
        blockchain_memo = NULL,
        blockchain_fee = NULL,

        blockchain_from_address = NULL,
        blockchain_to_address = NULL,
        blockchain_network = NULL,

        paid_at = NULL,
        completed_at = NULL

      WHERE id = $1
        AND status = 'FAILED'
      `,
      [
        withdrawalId,
      ]
    );

  vlog(
    "RETRY_RESULT",
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

  await createWithdrawalSettlementEventOnce({

    withdrawalId,

    eventType:
      WithdrawalSettlementEvents.WITHDRAW_RETRY,

    source:
      "wallet.withdraw",

    reason:
      "Withdrawal retry requested",

    metadata: {},

  });

  vlog(
    "RETRY_DONE",
    {
      withdrawalId,
    }
  );
}
