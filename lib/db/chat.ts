// =========================================================
// lib/db/chat.ts
// =========================================================

import { query } from "@/lib/db";

export type ChatRoom = {
  id: string;
  room_type: "support" | "seller" | "group";
  status: "open" | "closed";
  created_by: string;
  created_at: Date;
  updated_at: Date;

  last_message: string | null;
  last_message_at: Date | null;
  unread_count_user: number;
  unread_count_admin: number;
};

export type ChatMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: "text";
  content: string;
  created_at: Date;
};
export type AdminChatRoom = {
  room_id: string;
  room_type: "support" | "seller" | "group";
  status: "open" | "closed";
  updated_at: Date;
  last_message: string | null;
  last_message_at: Date | null;
  unread_count_admin: number;
  user_id: string;
  username: string;
};
export type SupportChatData = {
  room: ChatRoom;
  welcome: {
    title: string;
    content: string;
  } | null;
};
export type ChatTemplate = {
  id: string;
  code: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};
/* =========================================================
   GET SUPPORT ROOM BY USER
========================================================= */

export async function getSupportRoomByUserId(
  userId: string
): Promise<ChatRoom | null> {
  const result = await query<ChatRoom>(
    `
      SELECT r.*
      FROM chat_rooms r
      INNER JOIN chat_participants p
        ON p.room_id = r.id
      WHERE
        p.participant_id = $1
        AND r.room_type = 'support'
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] ?? null;
}

/* =========================================================
   CREATE SUPPORT ROOM
========================================================= */

export async function createSupportRoom(
  userId: string
): Promise<ChatRoom> {
  const roomResult = await query<ChatRoom>(
    `
      INSERT INTO chat_rooms
      (
        room_type,
        status,
        created_by
      )
      VALUES
      (
        'support',
        'open',
        $1
      )
      RETURNING *
    `,
    [userId]
  );

  const room = roomResult.rows[0];

  await query(
`
INSERT INTO chat_participants
(
    room_id,
    participant_id,
    role
)
VALUES
(
    $1,
    $2,
    'user'
)
`,
[
    room.id,
    userId,
]
);

  return room;
}

/* =========================================================
   GET ROOM MESSAGES
========================================================= */

export async function getMessagesByRoomId(
  roomId: string
): Promise<ChatMessage[]> {
  const result = await query<ChatMessage>(
    `
      SELECT *
      FROM chat_messages
      WHERE room_id = $1
      ORDER BY created_at ASC
    `,
    [roomId]
  );

  return result.rows;
}

/* =========================================================
   CREATE MESSAGE
========================================================= */

export async function createMessage(
  roomId: string,
  senderId: string,
  content: string,
  isAdmin: boolean
): Promise<ChatMessage> {

  console.log(
    "[CHAT][DB] INSERT MESSAGE",
    {
      roomId,
      senderId,
      content,
    }
  );

  const result = await query<ChatMessage>(
    `
      INSERT INTO chat_messages
      (
        room_id,
        sender_id,
        message_type,
        content
      )
      VALUES
      (
        $1,
        $2,
        'text',
        $3
      )
      RETURNING *
    `,
    [
      roomId,
      senderId,
      content,
    ]
  );

  await query(
  `
    UPDATE chat_rooms
    SET
      updated_at = NOW(),
      last_message = $2,
      last_message_at = NOW(),

      unread_count_admin =
        CASE
          WHEN $3
          THEN unread_count_admin
          ELSE unread_count_admin + 1
        END,

      unread_count_user =
        CASE
          WHEN $3
          THEN unread_count_user + 1
          ELSE unread_count_user
        END

    WHERE id = $1
  `,
  [
    roomId,
    content,
    isAdmin,
  ]
);

  return result.rows[0];
}

/* =========================================================
   GET ROOM BY ID
========================================================= */

export async function getRoomById(
  roomId: string
): Promise<ChatRoom | null> {
  const result = await query<ChatRoom>(
    `
      SELECT *
      FROM chat_rooms
      WHERE id = $1
      LIMIT 1
    `,
    [roomId]
  );

  return result.rows[0] ?? null;
}

/* =========================================================
   CHECK ROOM PARTICIPANT
========================================================= */

export async function isParticipant(
  roomId: string,
  userId: string
): Promise<boolean> {
  const result = await query<{ exists: number }>(
    `
      SELECT 1 AS exists
      FROM chat_participants
      WHERE room_id = $1
        AND participant_id = $2
      LIMIT 1
    `,
    [
      roomId,
      userId,
    ]
  );

  return result.rowCount > 0;
}
/* =========================================================
   GET ADMIN CHAT ROOMS
========================================================= */

export async function getAdminRooms(): Promise<AdminChatRoom[]> {
  const result = await query<AdminChatRoom>(
    `
      SELECT
  r.id AS room_id,
  r.room_type,
  r.status,
  r.updated_at,

  r.last_message,
  r.last_message_at,
  r.unread_count_admin,

  u.id AS user_id,
  u.username
FROM chat_rooms r
INNER JOIN chat_participants p
  ON p.room_id = r.id
INNER JOIN users u
  ON u.id = p.participant_id
WHERE
  p.role = 'user'
ORDER BY
  r.last_message_at DESC NULLS LAST,
  r.updated_at DESC
    `
  );

  return result.rows;
}
/* =========================================================
   GET CHAT TEMPLATE CONTENT
========================================================= */

export async function getChatTemplateContent(
  code: string
): Promise<string | null> {

  console.log(
    "[CHAT_TEMPLATE] START",
    {
      code,
    }
  );

  const result =
    await query<{
      content: string;
    }>(
      `
        SELECT content
        FROM chat_templates
        WHERE
          code = $1
          AND is_active = TRUE
        LIMIT 1
      `,
      [
        code,
      ]
    );

  console.log(
    "[CHAT_TEMPLATE] ROW_COUNT",
    result.rowCount
  );

  console.log(
    "[CHAT_TEMPLATE] ROW",
    result.rows[0]
  );

  const content =
    result.rows[0]?.content ??
    null;

  console.log(
    "[CHAT_TEMPLATE] CONTENT",
    content
  );

  return content;

}
