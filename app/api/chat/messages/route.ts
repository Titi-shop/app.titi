// =========================================================
// app/api/chat/messages/route.ts
// =========================================================

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireAuth,
} from "@/lib/auth/guard";

import {
  createMessage,
  createSystemMessage,
  getMessagesByRoomId,
  getRoomById,
  isParticipant,
  getChatTemplateContent,
} from "@/lib/db/chat";

export const runtime = "nodejs";
// =========================================================
// GET MESSAGES
// =========================================================

export async function GET(
  request: NextRequest
) {

  try {

    const auth =
      await requireAuth();

    if (!auth.ok) {
      return auth.response;
    }

    if (!auth.userId) {

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

    const participant =
      await isParticipant(
        roomId,
        auth.userId
      );

    if (!participant) {

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

    let messages =
  await getMessagesByRoomId(
    roomId
  );

console.log(
  "[CHAT][GET] MESSAGE_COUNT",
  messages.length
);

if (
  messages.length === 0
) {

  console.log(
    "[CHAT][GET] CREATE_SYSTEM_MESSAGE"
  );

  const content =
    await getChatTemplateContent(
      "support_welcome"
    );

  console.log(
    "[CHAT][GET] TEMPLATE",
    content
  );

  if (content) {

    await createSystemMessage(
      roomId,
      content
    );

    console.log(
      "[CHAT][GET] SYSTEM_MESSAGE_CREATED"
    );

    messages =
      await getMessagesByRoomId(
        roomId
      );

    console.log(
      "[CHAT][GET] RELOAD_MESSAGES",
      messages.length
    );

  }

}

return NextResponse.json({
  messages,
});
  } catch (err) {

    console.error(
      "[CHAT][GET]",
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

  console.time(
    "[CHAT][POST] TOTAL"
  );

    const auth =
  await requireAuth();

console.timeLog(
  "[CHAT][POST] TOTAL",
  "AUTH_DONE"
);

    if (!auth.ok) {
      return auth.response;
    }

    if (!auth.userId) {
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

    const body:
      | {
          roomId?: string;
          content?: string;
        }
      | undefined =
      await request.json();
console.timeLog(
  "[CHAT][POST] TOTAL",
  "BODY_DONE"
);
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
console.timeLog(
  "[CHAT][POST] TOTAL",
  "ROOM_DONE"
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

    const participant =
      await isParticipant(
        roomId,
        auth.userId
      );
console.timeLog(
  "[CHAT][POST] TOTAL",
  "PARTICIPANT_DONE"
);
    if (!participant) {
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
console.log(
  "[CHAT][POST] CREATE_MESSAGE"
);
    const message =
      await createMessage(
        roomId,
        auth.userId,
        content,
        false
      );
console.timeLog(
  "[CHAT][POST] TOTAL",
  "MESSAGE_CREATED"
);
    console.timeEnd(
  "[CHAT][POST] TOTAL"
);

return NextResponse.json({
  message,
});

  } catch (err) {

    console.error(
      "[CHAT][POST]",
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
