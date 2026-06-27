import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import {
  payWithdrawal,
} from "@/lib/payments/a2u.orchestrator";

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

    if (
      typeof id !== "string" ||
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

    const result =
      await payWithdrawal(id);
console.log(
  "[ADMIN_PAY_WITHDRAW][RESULT]",
  result
);
    return NextResponse.json({
      success: true,
      ...result,
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
