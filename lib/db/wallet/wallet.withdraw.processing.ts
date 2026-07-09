// =====================================================
// lib/db/wallet/wallet.withdraw.processing.ts
// =====================================================

import {
  query,
} from "@/lib/db";

import {
  createWithdrawalSettlementEventOnce,
  WithdrawalSettlementEvents,
} from "@/lib/db/settlement/settlement.event.a2u";
import {
  logger,
} from "@/lib/logger";

export async function markWithdrawalProcessing(
  withdrawalId: string,
  piPaymentId: string,
  piPaymentMemo?: string,
  piUid?: string
): Promise<void> {

  logger.info(
  "WALLET_WITHDRAW.PROCESSING_START"
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

  logger.debug(
  "WALLET_WITHDRAW.PROCESSING_UPDATED"
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
  logger.info(
  "WALLET_WITHDRAW.PROCESSING_DONE"
);
}
