// =========================================================
// app/api/notifications/route.ts
// =========================================================

import { NextResponse } from "next/server";

import {
  getUserFromBearer,
} from "@/lib/auth/getUserFromBearer";

import {
  getNotificationsByUserId,
} from "@/lib/db/notifications";

export const runtime = "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET() {

  try {

    const user =
      await getUserFromBearer();

    if (!user) {

      return NextResponse.json(
        {
          error:
            "UNAUTHORIZED",
        },
        {
          status: 401,
        }
      );

    }

    const notifications =
      await getNotificationsByUserId(
        user.userId
      );

    return NextResponse.json(
      notifications
    );

  } catch (err) {

    console.error(
      "[NOTIFICATIONS]",
      err
    );

    return NextResponse.json(
      {
        error:
          "SERVER_ERROR",
      },
      {
        status: 500,
      }
    );

  }

}
