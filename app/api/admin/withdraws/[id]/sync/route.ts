import { NextResponse } from "next/server";

import {
  requireAdmin,
} from "@/lib/auth/guard";

import {
  getA2UPayment,
} from "@/lib/pi/pi.a2u";

import {
  getWalletWithdrawalById,
  markWithdrawalCompleted,
  markWithdrawalFailed,
} from "@/lib/db/wallet/wallet.withdraw";
import {
  markWithdrawalFailed,
} from "@/lib/db/wallet/wallet.withdraw.";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[ADMIN_SYNC_WITHDRAW][${step}]`,
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

    if (!id) {
      return NextResponse.json(
        {
          error:
            "INVALID_WITHDRAWAL_ID",
        },
        {
          status: 400,
        }
      );
    }

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

    if (
      !withdrawal.pi_payment_id
    ) {
      return NextResponse.json(
        {
          error:
            "PI_PAYMENT_ID_MISSING",
        },
        {
          status: 400,
        }
      );
    }

    vlog(
      "LOAD_PI_PAYMENT",
      {
        paymentId:
          withdrawal.pi_payment_id,
      }
    );

    const payment =
      await getA2UPayment(
        withdrawal.pi_payment_id
      );

    vlog(
      "PI_PAYMENT",
      payment
    );

    const completed =
      payment.status
        ?.developer_completed ===
      true;

    const txid =
      payment.transaction
        ?.txid;

    if (
      completed &&
      txid
    ) {
      await markWithdrawalCompleted(
        withdrawal.id,
        txid
      );

      vlog(
        "MARK_COMPLETED_DONE",
        {
          withdrawalId:
            withdrawal.id,
          txid,
        }
      );

      return NextResponse.json({
        success: true,
        synced: true,
        status:
          "COMPLETED",
        txid,
      });
    }

    if (
      payment.status
        ?.cancelled
    ) {
      await markWithdrawalFailed(
        withdrawal.id,
        "PI_PAYMENT_CANCELLED"
      );

      return NextResponse.json({
        success: true,
        synced: true,
        status:
          "FAILED",
      });
    }

    return NextResponse.json({
      success: true,
      synced: false,
      status:
        withdrawal.status,
      pi_status:
        payment.status,
    });
  } catch (error) {
    console.error(
      "[ADMIN_SYNC_WITHDRAW][ERROR]",
      error
    );

    return NextResponse.json(
      {
        error:
          "SYNC_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}
