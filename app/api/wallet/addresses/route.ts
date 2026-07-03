// =====================================================
// app/api/wallet/addresses/route.ts
// =====================================================

export const runtime = "nodejs";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireAuth,
} from "@/lib/auth/guard";

import {
  createWalletAddressFlow,
  listWalletAddressesFlow,
} from "@/lib/services/wallet-address.service";

/* =====================================================
   LOG
===================================================== */

function log(
  tag: string,
  data?: unknown
) {
  console.log(
    `[API][WALLET_ADDRESS] ${tag}`,
    data ?? ""
  );
}

function err(
  tag: string,
  data?: unknown
) {
  console.error(
    `[API][WALLET_ADDRESS] ${tag}`,
    data ?? ""
  );
}

/* =====================================================
   GET
===================================================== */

export async function GET(
  request: NextRequest
) {

  log("GET_START");

  try {

    const auth =
      await requireAuth(
        request
      );

    if (!auth.ok) {

      log("AUTH_FAILED");

      return auth.response;

    }

    log(
      "AUTH_SUCCESS",
      {
        userId:
          auth.userId,
      }
    );

    const wallets =
      await listWalletAddressesFlow(
        auth.userId
      );

    log(
      "GET_SUCCESS",
      {
        userId:
          auth.userId,

        total:
          wallets.length,
      }
    );

    return NextResponse.json({
      wallets,
    });

  } catch (error) {

    err(
      "GET_FAILED",
      error
    );

    return NextResponse.json(
      {
        error:
          "INTERNAL_ERROR",
      },
      {
        status: 500,
      }
    );

  }

}

/* =====================================================
   POST
===================================================== */

export async function POST(
  request: NextRequest
) {

  log("POST_START");

  try {

    const auth =
      await requireAuth(
        request
      );

    if (!auth.ok) {

      log("AUTH_FAILED");

      return auth.response;

    }

    log(
      "AUTH_SUCCESS",
      {
        userId:
          auth.userId,
      }
    );

    log(
      "BODY_START"
    );

    const body =
      await request.json();

    log(
      "BODY_DONE",
      {
        hasAddress:
          typeof body?.address ===
          "string",

        hasLabel:
          typeof body?.label ===
          "string",
      }
    );

    log(
      "SERVICE_START"
    );

    const wallet =
      await createWalletAddressFlow({

        userId:
          auth.userId,

        body,

      });

    log(
      "SERVICE_DONE",
      {
        walletAddressId:
          wallet.id,
      }
    );

    log(
      "POST_SUCCESS"
    );

    return NextResponse.json({

      success: true,

      wallet,

    });

  } catch (error) {

    err(
      "POST_FAILED",
      error
    );

    return NextResponse.json(
      {
        error:
          "INTERNAL_ERROR",
      },
      {
        status: 500,
      }
    );

  }

}
