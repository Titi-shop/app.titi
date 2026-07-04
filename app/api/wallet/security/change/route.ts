// =====================================================
// app/api/wallet/security/change/route.ts
// =====================================================

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireAuth,
} from "@/lib/auth/guard";

import {
  changeWalletPinFlow,
} from "@/lib/services/wallet-security.service";

export const runtime =
  "nodejs";

/* =====================================================
   TYPES
===================================================== */

type RequestBody = {

  currentPin?: unknown;

  newPin?: unknown;

};

/* =====================================================
   LOG
===================================================== */

function log(
  tag: string,
  data?: unknown
) {

  console.log(
    `[API][WALLET_SECURITY] ${tag}`,
    data ?? ""
  );

}

function err(
  tag: string,
  data?: unknown
) {

  console.error(
    `[API][WALLET_SECURITY] ${tag}`,
    data ?? ""
  );

}
/* =====================================================
   POST
===================================================== */

export async function POST(
  request: NextRequest
) {

  try {

    log(
      "CHANGE_START"
    );

    /* ===============================================
       AUTH
    =============================================== */

    const auth =
      await requireAuth();

    if (!auth.ok) {

      log(
        "AUTH_FAILED"
      );

      return auth.response;

    }

    log(
      "AUTH_SUCCESS",
      {
        userId:
          auth.userId,
      }
    );

    /* ===============================================
       BODY
    =============================================== */

    const body:
      unknown =
        await request.json();

    if (
      typeof body !==
        "object" ||
      body === null
    ) {

      return NextResponse.json(

        {

          success: false,

          error:
            "INVALID_BODY",

        },

        {

          status: 400,

        }

      );

    }

    const data =
      body as RequestBody;

    /* ===============================================
       CURRENT PIN
    =============================================== */

    const currentPin =
      typeof data.currentPin ===
      "string"
        ? data.currentPin.trim()
        : "";

    if (
      !/^\d{6}$/.test(
        currentPin
      )
    ) {

      return NextResponse.json(

        {

          success: false,

          error:
            "INVALID_CURRENT_PIN",

        },

        {

          status: 400,

        }

      );

    }

    /* ===============================================
       NEW PIN
    =============================================== */

    const newPin =
      typeof data.newPin ===
      "string"
        ? data.newPin.trim()
        : "";

    if (
      !/^\d{6}$/.test(
        newPin
      )
    ) {

      return NextResponse.json(

        {

          success: false,

          error:
            "INVALID_NEW_PIN",

        },

        {

          status: 400,

        }

      );

    }
        /* ===============================================
       CHANGE PIN
    =============================================== */

    await changeWalletPinFlow({

      userId:
        auth.userId,

      currentPin,

      newPin,

    });

    log(
      "CHANGE_SUCCESS",
      {
        userId:
          auth.userId,
      }
    );

    return NextResponse.json({

      success: true,

    });

  } catch (error) {

    err(
      "CHANGE_FAILED",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "INTERNAL_ERROR";

    switch (message) {

      case "INVALID_PIN":

        return NextResponse.json(

          {

            success: false,

            error:
              "INVALID_PIN",

          },

          {

            status: 400,

          }

        );

      case "PIN_LOCKED":

        return NextResponse.json(

          {

            success: false,

            error:
              "PIN_LOCKED",

          },

          {

            status: 423,

          }

        );

      case "PIN_NOT_CHANGED":

        return NextResponse.json(

          {

            success: false,

            error:
              "PIN_NOT_CHANGED",

          },

          {

            status: 400,

          }

        );

      case "SECURITY_NOT_FOUND":

        return NextResponse.json(

          {

            success: false,

            error:
              "SECURITY_NOT_FOUND",

          },

          {

            status: 404,

          }

        );

      default:

        return NextResponse.json(

          {

            success: false,

            error:
              "INTERNAL_ERROR",

          },

          {

            status: 500,

          }

        );

    }

  }

}
