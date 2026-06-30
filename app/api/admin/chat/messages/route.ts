// =========================================================
// app/api/admin/chat/messages/route.ts
// =========================================================

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireAdmin,
} from "@/lib/auth/guard";

import {
  createMessage,
  getMessagesByRoomId,
  getRoomById,
} from "@/lib/db/chat";

export const runtime =
  "nodejs";

/* =========================================================
   GET MESSAGES
========================================================= */

export async function GET(
  request: NextRequest
) {
  try {

    const auth =
      await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const roomId =
      request.nextUrl.searchParams.get(
        "roomId"
      );

    if (!roomId) {
      return NextResponse.json(
        {
          error:
            "INVALID_ROOM_ID",
        },
        {
          status: 400,
        }
      );
    }

    const room =
      await getRoomById(
        roomId
      );

    if (!room) {
      return NextResponse.json(
        {
          error:
            "ROOM_NOT_FOUND",
        },
        {
          status: 404,
        }
      );
    }

    const messages =
      await getMessagesByRoomId(
        roomId
      );

    return NextResponse.json({
      messages,
    });

  } catch (err) {

    console.error(
      "[ADMIN_CHAT][GET]",
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

/* =========================================================
   CREATE MESSAGE
========================================================= */

export async function POST(
  request: NextRequest
) {
  try {

    const auth =
      await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const body:
      | {
          roomId?: string;
          content?: string;
        }
      | undefined =
      await request.json();

    const roomId =
      String(
        body?.roomId ?? ""
      ).trim();

    const content =
      String(
        body?.content ?? ""
      ).trim();

    if (!roomId) {
      return NextResponse.json(
        {
          error:
            "INVALID_ROOM_ID",
        },
        {
          status: 400,
        }
      );
    }

    if (!content) {
      return NextResponse.json(
        {
          error:
            "EMPTY_MESSAGE",
        },
        {
          status: 400,
        }
      );
    }

    const room =
      await getRoomById(
        roomId
      );

    if (!room) {
      return NextResponse.json(
        {
          error:
            "ROOM_NOT_FOUND",
        },
        {
          status: 404,
        }
      );
    }

    const message =
      await createMessage(
        roomId,
        auth.userId,
        content,
        true
      );

    return NextResponse.json({
      message,
    });

  } catch (err) {

    console.error(
      "[ADMIN_CHAT][POST]",
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
