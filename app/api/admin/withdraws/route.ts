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

    const auth =
      await requireAdmin();

    vlog("GUARD_RESULT", {
      ok: auth.ok,
    });

    if (!auth.ok) {
      return auth.response;
    }

    /* =========================
       LOAD WITHDRAWALS
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

    /* =========================
       RESPONSE
    ========================= */

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
          "WITHDRAW_LIST_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}
