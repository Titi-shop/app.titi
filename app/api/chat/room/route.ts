// =========================================================
// app/api/chat/room/route.ts
// =========================================================

import {
  NextResponse,
} from "next/server";

import {
  requireAuth,
} from "@/lib/auth/guard";

import {
  createSupportRoom,
  getSupportRoomByUserId,
} from "@/lib/db/chat";

export const runtime = "nodejs";

/* =========================================================
   GET SUPPORT ROOM
========================================================= */

export async function GET() {

  try {

    const auth =
      await requireAuth();

    if (!auth.ok) {
      return auth.response;
    }

    let room =
      await getSupportRoomByUserId(
        auth.userId
      );

    if (!room) {

      room =
        await createSupportRoom(
          auth.userId
        );

    }

    return NextResponse.json({
      room,
    });

  } catch (err) {

    console.error(
      "[CHAT][ROOM]",
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
