// =========================================================
// app/api/admin/chat/rooms/route.ts
// =========================================================

import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/guard";

import {
  getAdminRooms,
} from "@/lib/db/chat";

export const runtime = "nodejs";

/* =========================================================
   GET ADMIN CHAT ROOMS
========================================================= */

export async function GET() {
  try {
    const auth =
      await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const rooms =
      await getAdminRooms();

    return NextResponse.json({
      rooms,
    });
  } catch (err) {
    console.error(
      "[ADMIN_CHAT][ROOMS]",
      err
    );

    return NextResponse.json(
      {
        error:
          "INTERNAL_SERVER_ERROR",
      },
      {
        status: 500,
      }
    );
  }
}
