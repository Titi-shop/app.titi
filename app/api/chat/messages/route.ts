// =========================================================
// app/api/chat/messages/route.ts
// =========================================================

import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guard";

import {
  createMessage,
  getMessagesByRoomId,
  getRoomById,
  isParticipant,
} from "@/lib/db/chat";

export const runtime = "nodejs";

/* =========================================================
   GET MESSAGES
========================================================= */

/* =========================================================
   GET MESSAGES
========================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    const auth =
      await requireAuth();

    console.log(
      "[CHAT][GET][AUTH]",
      auth
    );

    if (!auth.ok) {
      console.log(
        "[CHAT][GET][AUTH_FAIL]"
      );

      return auth.response;
    }

    const roomId =
      request.nextUrl.searchParams.get(
        "roomId"
      );

    console.log(
      "[CHAT][GET][ROOM_ID]",
      roomId
    );

    if (!roomId) {
      console.log(
        "[CHAT][GET][INVALID_ROOM_ID]"
      );

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

    console.log(
      "[CHAT][GET][ROOM]",
      room
    );

    if (!room) {
      console.log(
        "[CHAT][GET][ROOM_NOT_FOUND]"
      );

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

    console.log(
      "[CHAT][GET][ROLE]",
      auth.role
    );

    console.log(
      "[CHAT][GET][USER_ID]",
      auth.userId
    );

    if (!auth.userId) {
      console.log(
        "[CHAT][GET][NO_USER_ID]"
      );

      return NextResponse.json(
        {
          error:
            "FORBIDDEN",
        },
        {
          status: 403,
        }
      );
    }

    if (
      auth.role !==
      "admin"
    ) {
      console.log(
        "[CHAT][GET][CHECK_PARTICIPANT]"
      );

      const participant =
        await isParticipant(
          roomId,
          auth.userId
        );

      console.log(
        "[CHAT][GET][PARTICIPANT]",
        participant
      );

      if (!participant) {
        console.log(
          "[CHAT][GET][FORBIDDEN]"
        );

        return NextResponse.json(
          {
            error:
              "FORBIDDEN",
          },
          {
            status: 403,
          }
        );
      }
    }

    const messages =
      await getMessagesByRoomId(
        roomId
      );

    console.log(
      "[CHAT][GET][MESSAGES]",
      {
        count:
          messages.length,
      }
    );

    return NextResponse.json({
      messages,
    });
  } catch (err) {
    console.error(
      "[CHAT][MESSAGES][GET]",
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
      await requireAuth();

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

    if (!auth.userId) {
  return NextResponse.json(
    {
      error: "FORBIDDEN",
    },
    {
      status: 403,
    }
  );
}

if (auth.role !== "admin") {

  const participant =
    await isParticipant(
      roomId,
      auth.userId
    );

  if (!participant) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
      },
      {
        status: 403,
      }
    );
  }

}
console.log(
  "[CHAT][POST] START"
);
    const message =
      await createMessage(
        roomId,
        auth.userId,
        content
      );
console.log(
  "[CHAT][POST] CREATED",
  message
);
    return NextResponse.json({
      message,
    });
  } catch (err) {
    console.error(
      "[CHAT][MESSAGES][POST]",
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
