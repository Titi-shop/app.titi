import { NextResponse } from "next/server";

import {
  requireAdmin,
} from "@/lib/auth/guard";

import {
  approveWalletWithdrawal,
} from "@/lib/db/wallet/wallet.withdraw.approve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[ADMIN_APPROVE_WITHDRAW][${step}]`,
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

    /* =========================
       ADMIN GUARD
    ========================= */

    vlog("GUARD_START");

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
      vlog("FORBIDDEN");

      return auth.response;
    }

    /* =========================
       PARAMS
    ========================= */

    const { id } =
      await context.params;

    vlog(
      "PARAMS",
      {
        withdrawalId:
          id,
      }
    );

    if (
      typeof id !==
        "string" ||
      !id.trim()
    ) {
      vlog(
        "INVALID_WITHDRAWAL_ID",
        id
      );

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

    /* =========================
       APPROVE
    ========================= */

    vlog(
      "APPROVE_START",
      {
        withdrawalId:
          id,
        adminId:
          auth.userId,
      }
    );

    await approveWalletWithdrawal(
      id,
      auth.userId
    );

    vlog(
      "APPROVE_DONE",
      {
        withdrawalId:
          id,
      }
    );

    /* =========================
       RESPONSE
    ========================= */

    vlog("SUCCESS");

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "[ADMIN_APPROVE_WITHDRAW][ERROR]",
      error
    );

    return NextResponse.json(
      {
        error:
          "APPROVE_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}
