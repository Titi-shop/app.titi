import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest
) {
  try {
    const authorization =
      req.headers.get(
        "authorization"
      );

    if (
      !authorization?.startsWith(
        "Bearer "
      )
    ) {
      return NextResponse.json(
        {
          error:
            "MISSING_AUTHORIZATION",
        },
        {
          status: 401,
        }
      );
    }

    const accessToken =
      authorization.replace(
        "Bearer ",
        ""
      );

    const me = await fetch(
      "https://api.minepi.com/v2/me",
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      }
    );

    if (!me.ok) {
      return NextResponse.json(
        {
          error:
            "INVALID_PI_TOKEN",
        },
        {
          status: 401,
        }
      );
    }

    const data =
      (await me.json()) as {
        uid: string;
        username?: string;
      };

    return NextResponse.json({
      pi_uid: data.uid,
      username:
        data.username ?? null,
    });
  } catch {
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
