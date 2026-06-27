import { NextResponse } from "next/server";

import {
  requireAdmin,
} from "@/lib/auth/guard";

import {
  getA2UPayment,
  completeA2UPayment,
} from "@/lib/pi/pi.a2u";

import {
  getWalletWithdrawalById,
  markWithdrawalCompleted,
} from "@/lib/db/wallet/wallet.withdraw";
import {
  markWithdrawalFailed,
} from "@/lib/db/wallet/wallet.withdraw.failed";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[ADMIN_RESUME_WITHDRAW][${step}]`,
    data ?? ""
  );
}

export async function POST(
  _req: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    vlog("START");

    const auth =
      await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const { id } =
      await context.params;

    const withdrawal =
      await getWalletWithdrawalById(
        id
      );

    if (!withdrawal) {
      return NextResponse.json(
        {
          error:
            "WITHDRAWAL_NOT_FOUND",
        },
        {
          status: 404,
        }
      );
    }

    vlog(
      "WITHDRAWAL",
      withdrawal
    );

    if (
      withdrawal.status !==
      "PROCESSING"
    ) {
      return NextResponse.json(
        {
          error:
            "WITHDRAWAL_NOT_PROCESSING",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !withdrawal.pi_payment_id
    ) {
      return NextResponse.json(
        {
          error:
            "PAYMENT_ID_MISSING",
        },
        {
          status: 400,
        }
      );
    }

    const payment =
      await getA2UPayment(
        withdrawal.pi_payment_id
      );
vlog(
  "PAYMENT_STATUS",
  {
    paymentId:
      withdrawal.pi_payment_id,

    developerApproved:
      payment.status
        ?.developer_approved,

    transactionVerified:
      payment.status
        ?.transaction_verified,

    developerCompleted:
      payment.status
        ?.developer_completed,

    cancelled:
      payment.status
        ?.cancelled,

    userCancelled:
      payment.status
        ?.user_cancelled,

    txid:
      payment.transaction
        ?.txid ??
      null,
  }
);
    vlog(
      "PAYMENT",
      payment
    );

    if (
      payment.status
        ?.cancelled ||
      payment.status
        ?.user_cancelled
    ) {
      await markWithdrawalFailed(
        withdrawal.id,
        "PAYMENT_CANCELLED"
      );

      return NextResponse.json({
        success: false,
        status:
          "CANCELLED",
      });
    }

    const txid =
      payment.transaction
        ?.txid;

    if (
  payment.status
    ?.developer_completed &&
  withdrawal.blockchain_txid
) {
  vlog(
    "ALREADY_COMPLETED_ON_PI",
    {
      withdrawalId:
        withdrawal.id,

      txid:
        withdrawal.blockchain_txid,
    }
  );

  await markWithdrawalCompleted(
    withdrawal.id,
    withdrawal.blockchain_txid
  );

  return NextResponse.json({
    success: true,
    status:
      "RECOVERED",
  });
}
    if (!txid) {
      return NextResponse.json({
        success: false,
        status:
          "TX_NOT_FOUND",
      });
    }

    if (
      !payment.status
        ?.developer_completed
    ) {
      vlog(
        "COMPLETE_PAYMENT",
        {
          paymentId:
            withdrawal.pi_payment_id,
          txid,
        }
      );

      await completeA2UPayment(
        withdrawal.pi_payment_id,
        txid
      );
    }

    await markWithdrawalCompleted(
  withdrawal.id,
  txid,

  undefined,
  undefined,
  undefined,

  payment.from_address,
  payment.to_address,
  payment.network
);

    vlog(
      "COMPLETED",
      {
        withdrawalId:
          withdrawal.id,
        txid,
      }
    );

    return NextResponse.json({
      success: true,
      withdrawalId:
        withdrawal.id,
      txid,
      status:
        "COMPLETED",
    });
  } catch (error) {
    console.error(
      "[ADMIN_RESUME_WITHDRAW][ERROR]",
      error
    );

    return NextResponse.json(
      {
        error:
          "RESUME_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}
