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

import {
  getChatTemplateByCode,
} from "@/lib/db/chat_templates";

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

    const welcome =
      await getChatTemplateByCode(
        "support_welcome"
      );

    return NextResponse.json({
      room,
      welcome,
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
