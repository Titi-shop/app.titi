import { NextResponse } from "next/server";

import {
  requireAdmin,
} from "@/lib/auth/guard";

import {
  getWalletWithdrawalById,
  markWithdrawalCompleted,
} from "@/lib/db/wallet/wallet.withdraw";

import {
  getA2UPayment,
  completeA2UPayment,
} from "@/lib/pi/pi.a2u";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {

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

    const payment =
      await getA2UPayment(
        withdrawal.pi_payment_id
      );

    const txid =
      payment.transaction?.txid;

    if (!txid) {
      return NextResponse.json(
        {
          error:
            "TXID_NOT_FOUND",
        },
        {
          status: 400,
        }
      );
    }

    await completeA2UPayment(
      withdrawal.pi_payment_id,
      txid
    );

    await markWithdrawalCompleted(
      withdrawal.id,
      txid
    );

    return NextResponse.json({
      success: true,
      txid,
    });

  } catch (error) {
    console.error(
      "[ADMIN_COMPLETE_WITHDRAW]",
      error
    );

    return NextResponse.json(
      {
        error:
          "COMPLETE_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}
