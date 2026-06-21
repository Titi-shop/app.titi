import { NextResponse } from "next/server";

import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { query } from "@/lib/db";

import {
  getWithdrawRequests,
} from "@/lib/db/withdraw.requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth =
      await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const adminRes =
      await query(
        `
        SELECT is_admin
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [auth.userId]
      );

    if (
      !adminRes.rows[0]
        ?.is_admin
    ) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const rows =
      await getWithdrawRequests();

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    console.error(
      "[ADMIN_WITHDRAWS]",
      error
    );

    return NextResponse.json(
      {
        error:
          "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
