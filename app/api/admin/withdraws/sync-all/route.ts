import { NextResponse } from "next/server";

import {
  requireAdmin,
} from "@/lib/auth/guard";

import {
  getA2UPayment,
} from "@/lib/pi/pi.a2u";

import {
  getProcessingWithdrawals,
  markWithdrawalCompleted,
  markWithdrawalFailed,
} from "@/lib/db/wallet/wallet.withdraw";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[ADMIN_SYNC_ALL][${step}]`,
    data ?? ""
  );
}

export async function GET() {
  try {
    vlog("START");

    const auth =
      await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const withdrawals =
      await getProcessingWithdrawals();

    vlog(
      "PROCESSING_FOUND",
      {
        count:
          withdrawals.length,
      }
    );

    const results:
      Array<{
        withdrawalId: string;
        status: string;
        txid?: string;
      }> = [];

    for (
      const withdrawal
      of withdrawals
    ) {
      try {
        if (
          !withdrawal.pi_payment_id
        ) {
          results.push({
            withdrawalId:
              withdrawal.id,
            status:
              "NO_PAYMENT_ID",
          });

          continue;
        }

        const payment =
  await getA2UPayment(
    withdrawal.pi_payment_id
  );

vlog(
  "PAYMENT_SNAPSHOT",
  {
    withdrawalId:
      withdrawal.id,

    paymentId:
      withdrawal.pi_payment_id,

    developerCompleted:
      payment.status
        ?.developer_completed,

    transactionVerified:
      payment.status
        ?.transaction_verified,

    cancelled:
      payment.status
        ?.cancelled,

    userCancelled:
      payment.status
        ?.user_cancelled,

    transaction:
      payment.transaction ??
      null,
  }
);

        if (
          payment.status
            ?.developer_completed &&
          payment.transaction
            ?.txid
        ) {
          await markWithdrawalCompleted(
            withdrawal.id,
            payment.transaction.txid
          );

          results.push({
            withdrawalId:
              withdrawal.id,
            status:
              "COMPLETED",
            txid:
              payment.transaction
                .txid,
          });

          continue;
        }

        if (
          payment.status
            ?.cancelled
        ) {
          await markWithdrawalFailed(
            withdrawal.id,
            "PI_PAYMENT_CANCELLED"
          );

          results.push({
            withdrawalId:
              withdrawal.id,
            status:
              "FAILED",
          });

          continue;
        }

        vlog(
  "STILL_PROCESSING_REASON",
  {
    withdrawalId:
      withdrawal.id,

    developerCompleted:
      payment.status
        ?.developer_completed,

    transactionVerified:
      payment.status
        ?.transaction_verified,

    transaction:
      payment.transaction ??
      null,
  }
);

results.push({
  withdrawalId:
    withdrawal.id,
  status:
    "STILL_PROCESSING",
});
      } catch (error) {
        console.error(
          "[ADMIN_SYNC_ALL][ITEM_ERROR]",
          error
        );

        results.push({
          withdrawalId:
            withdrawal.id,
          status:
            "ERROR",
        });
      }
    }

    vlog(
      "DONE",
      {
        count:
          results.length,
      }
    );

    return NextResponse.json({
      success: true,
      count:
        results.length,
      results,
    });
  } catch (error) {
    console.error(
      "[ADMIN_SYNC_ALL][ERROR]",
      error
    );

    return NextResponse.json(
      {
        error:
          "SYNC_ALL_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}
