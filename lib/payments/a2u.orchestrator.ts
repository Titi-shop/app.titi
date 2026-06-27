// =====================================================
// lib/payments/a2u.orchestrator.ts
// =====================================================

import {
  getUserById,
} from "@/lib/db/users";
import {
  verifyWithdrawalRpc,
} from "@/lib/db/payments.rpc.a2u";
import {
  getWalletWithdrawalById,
  markWithdrawalProcessing,
  markWithdrawalCompleted,
  markWithdrawalFailed,
} from "@/lib/db/wallet/wallet.withdraw";

import {
  createA2UPayment,
  submitA2UPayment,
  completeA2UPayment,
} from "@/lib/pi/pi.a2u";

function log(
  step: string,
  data?: unknown
) {
  console.log(
    `[A2U_ORCHESTRATOR] ${step}`,
    data ?? ""
  );
}

export async function payWithdrawal(
  withdrawalId: string
) {
  let processingStarted =
    false;

  try {

    log(
      "START",
      withdrawalId
    );

    const withdrawal =
      await getWalletWithdrawalById(
        withdrawalId
      );

    if (!withdrawal) {
      throw new Error(
        "WITHDRAWAL_NOT_FOUND"
      );
    }

    if (
      withdrawal.status ===
      "PROCESSING"
    ) {
      throw new Error(
        "WITHDRAWAL_ALREADY_PROCESSING"
      );
    }

    if (
      withdrawal.status ===
      "COMPLETED"
    ) {
      throw new Error(
        "WITHDRAWAL_ALREADY_COMPLETED"
      );
    }

    if (
      ![
        "APPROVED",
        "FAILED",
      ].includes(
        withdrawal.status
      )
    ) {
      throw new Error(
        "INVALID_STATUS"
      );
    }

    const user =
      await getUserById(
        withdrawal.user_id
      );

    if (!user?.pi_uid) {
      throw new Error(
        "USER_PI_UID_MISSING"
      );
    }

    const piPaymentId =
      await createA2UPayment({
        uid: user.pi_uid,
        amount: Number(
          withdrawal.amount
        ),
        memo:
          `Withdraw ${withdrawal.id}`,
        metadata: {
          withdrawal_id:
            withdrawal.id,
        },
      });

    await markWithdrawalProcessing(
      withdrawal.id,
      piPaymentId,
      `Withdraw ${withdrawal.id}`,
      user.pi_uid
    );

    processingStarted =
      true;

    const tx =
  await submitA2UPayment(
    piPaymentId
  );

await completeA2UPayment(
  piPaymentId,
  tx.txid
);

await verifyWithdrawalRpc(
  withdrawal.id,
  tx.txid
);

await markWithdrawalCompleted(
  withdrawal.id
);

    return {
      withdrawalId:
        withdrawal.id,
      piPaymentId,
      txid:
        tx.txid,
    };
  }
  catch (error) {

    if (
      processingStarted
    ) {
      try {
        await markWithdrawalFailed(
          withdrawalId,
          error instanceof Error
            ? error.message
            : String(error)
        );
      }
      catch (
        rollbackError
      ) {
        console.error(
          "[A2U_ORCHESTRATOR][ROLLBACK]",
          rollbackError
        );
      }
    }

    throw error;
  }
}
