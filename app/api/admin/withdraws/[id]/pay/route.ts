import { NextResponse } from "next/server";

import {
  requireAdmin,
} from "@/lib/auth/guard";

import {
  getWalletWithdrawalById,
  markWithdrawalProcessing,
} from "@/lib/db/wallet/wallet.withdraw";

export const runtime = "nodejs";
export const dynamic =
  "force-dynamic";

function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[ADMIN_PAY_WITHDRAW][${step}]`,
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

    /* =====================
       ADMIN GUARD
    ===================== */

    const auth =
      await requireAdmin();

    vlog(
      "GUARD_RESULT",
      auth.ok
        ? {
            ok: true,
            userId:
              auth.userId,
          }
        : {
            ok: false,
          }
    );

    if (!auth.ok) {
      return auth.response;
    }

    /* =====================
       PARAMS
    ===================== */

    const { id } =
      await context.params;

    vlog(
      "PARAMS",
      {
        withdrawalId: id,
      }
    );

    if (
      typeof id !==
        "string" ||
      !id.trim()
    ) {
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

    /* =====================
       LOAD WITHDRAWAL
    ===================== */

    vlog(
      "LOAD_WITHDRAWAL_START"
    );

    const withdrawal =
      await getWalletWithdrawalById(
        id
      );

    vlog(
      "LOAD_WITHDRAWAL_RESULT",
      withdrawal
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

    /* =====================
       STATUS CHECK
    ===================== */

    if (
      withdrawal.status !==
      "APPROVED"
    ) {
      vlog(
        "INVALID_STATUS",
        {
          status:
            withdrawal.status,
        }
      );

      return NextResponse.json(
        {
          error:
            "INVALID_STATUS",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================
       TEMP PAYMENT ID
       (replace later
       by real A2U)
    ===================== */

    const piPaymentId =
  await createA2UPayment({
    uid: withdrawal.user_id,
    amount: Number(withdrawal.amount),
    memo: `Withdraw ${withdrawal.id}`,
    metadata: {
      withdrawal_id:
        withdrawal.id,
    },
  });

await markWithdrawalProcessing(
  withdrawal.id,
  piPaymentId
);
    await markWithdrawalProcessing(
      withdrawal.id,
      piPaymentId
    );

    vlog(
      "MARK_PROCESSING_DONE"
    );

    /* =====================
       RESPONSE
    ===================== */

    vlog("SUCCESS");

    return NextResponse.json({
      success: true,
      withdrawal_id:
        withdrawal.id,
      pi_payment_id:
        piPaymentId,
      status:
        "PROCESSING",
    });
  } catch (error) {
    console.error(
      "[ADMIN_PAY_WITHDRAW][ERROR]",
      error
    );

    return NextResponse.json(
      {
        error: "PAY_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}
