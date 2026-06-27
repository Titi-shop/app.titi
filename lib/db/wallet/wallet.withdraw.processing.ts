// =====================================================
// lib/db/wallet/wallet.withdraw.processing.ts
// =====================================================

import {
  query,
} from "@/lib/db";

import {
  createWithdrawalSettlementEventOnce,
  WithdrawalSettlementEvents,
} from "@/lib/db/settlement/withdrawal.settlement.event";

function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[WALLET_WITHDRAW][${step}]`,
    data ?? ""
  );
}

export async function markWithdrawalProcessing(
  withdrawalId: string,
  piPaymentId: string,
  piPaymentMemo?: string,
  piUid?: string
): Promise<void> {

  vlog(
    "MARK_PROCESSING_START",
    {
      withdrawalId,
      piPaymentId,
    }
  );

  const rs =
    await query(
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

  vlog(
    "MARK_PROCESSING_RESULT",
    {
      rowCount:
        rs.rowCount,
    }
  );

  if (
    rs.rowCount !== 1
  ) {
    throw new Error(
      "WITHDRAWAL_PROCESSING_FAILED"
    );
  }

  await createWithdrawalSettlementEventOnce({
    withdrawalId,

    eventType:
      WithdrawalSettlementEvents.WITHDRAW_PROCESSING,

    source:
      "wallet.withdraw",

    reason:
      "Developer started blockchain payment",

    metadata: {
      piPaymentId,
    },
  });
}
