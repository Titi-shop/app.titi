import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/guard";
import {
  getWithdrawalById,
  retryWithdrawal,
} from "@/lib/db/wallet/wallet.withdraw";
";

export async function POST(
  _req: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    console.log(
      "[ADMIN_RETRY_WITHDRAW][START]"
    );

    const guard =
      await requireAdmin();

    if (!guard.ok) {
      return NextResponse.json(
        {
          error: "FORBIDDEN",
        },
        {
          status: 403,
        }
      );
    }

    const { id } =
      await context.params;

    console.log(
      "[ADMIN_RETRY_WITHDRAW][ID]",
      id
    );

    const withdrawal =
      await getWithdrawalById(id);

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
      withdrawal.status !==
      "FAILED"
    ) {
      return NextResponse.json(
        {
          error:
            "ONLY_FAILED_CAN_RETRY",
        },
        {
          status: 400,
        }
      );
    }

    await retryWithdrawal(id);

    console.log(
      "[ADMIN_RETRY_WITHDRAW][SUCCESS]"
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "[ADMIN_RETRY_WITHDRAW][ERROR]",
      error
    );

    return NextResponse.json(
      {
        error:
          "RETRY_WITHDRAW_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}
