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
  markWelcomeSent,
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

    let welcome = null;

if (!room.welcome_sent) {

  const template =
    await getChatTemplateByCode(
      "support_welcome"
    );

  if (template) {

    welcome = {
      title: template.title,
      content: template.content,
    };

    await markWelcomeSent(
      room.id
    );

    room.welcome_sent = true;
  }

}

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
