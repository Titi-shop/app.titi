
// =====================================================
// app/api/orders/preview/route.ts
// =====================================================

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireAuth,
} from "@/lib/auth/guard";

import {
  previewOrderFromRequest,
} from "@/lib/orders/order.preview.service";

export const runtime =
  "nodejs";

/* =====================================================
   LOG
===================================================== */

function maskId(
  value: string
): string {

  if (value.length <= 8) {

    return value;

  }

  return (
    value.slice(0, 4) +
    "..." +
    value.slice(-4)
  );

}

function vlog(
  step: string,
  data?: unknown
) {

  console.log(
    `[ORDER][PREVIEW][${step}]`,
    data ?? ""
  );

}

/* =====================================================
   POST
===================================================== */

export async function POST(
  req: NextRequest
) {

  try {

    vlog("START");

    /* ===============================================
       AUTH
    =============================================== */

    const auth =
      await requireAuth();

    if (!auth.ok) {

      vlog("AUTH_FAILED");

      return auth.response;

    }

    vlog(
      "AUTH_OK",
      {
        userId:
          maskId(
            auth.userId
          ),
      }
    );

    /* ===============================================
       BODY
    =============================================== */

    const body:
      unknown =
        await req.json();

    if (

      typeof body !==
        "object" ||

      body === null

    ) {

      vlog(
        "INVALID_BODY"
      );

      return NextResponse.json(
        {
          error:
            "INVALID_BODY",
        },
        {
          status: 400,
        }
      );

    }

    vlog(
      "SERVICE_START"
    );

    /* ===============================================
       SERVICE
    =============================================== */

    const result =
      await previewOrderFromRequest({

        userId:
          auth.userId,

        raw:
          body,

      });

    vlog(
      "SERVICE_SUCCESS"
    );

    return NextResponse.json(
      result
    );

  } catch (
    error
  ) {

    console.error(
      "[ORDER][PREVIEW][ERROR]",
      {
        message:
          error instanceof Error
            ? error.message
            : "UNKNOWN_ERROR",
      }
    );

    return NextResponse.json(
      {
        error:
          "PREVIEW_FAILED",
      },
      {
        status: 500,
      }
    );

  }

}
