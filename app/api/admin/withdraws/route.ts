import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/guard";

import {
  getWalletWithdrawals,
} from "@/lib/db/wallet/wallet.withdraw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[ADMIN_WITHDRAWS_API][${step}]`,
    data ?? ""
  );
}

export async function GET() {
  try {
    vlog("START");

    /* =========================
       ADMIN GUARD
    ========================= */

    vlog("GUARD_START");

    const admin =
      await requireAdmin();

    vlog(
      "GUARD_OK",
      admin
    );

    /* =========================
       LOAD DATA
    ========================= */

    vlog(
      "LOAD_WITHDRAWS_START"
    );

    const rows =
      await getWalletWithdrawals();

    vlog(
      "LOAD_WITHDRAWS_DONE",
      {
        count:
          rows.length,
      }
    );

    if (rows.length > 0) {
      vlog(
        "FIRST_ROW",
        rows[0]
      );
    }

    /* =========================
       RESPONSE
    ========================= */

    vlog(
      "SUCCESS_RESPONSE"
    );

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    console.error(
      "[ADMIN_WITHDRAWS_API][ERROR]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "FORBIDDEN",
      },
      {
        status: 403,
      }
    );
  }
}
