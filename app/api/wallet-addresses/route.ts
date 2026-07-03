// =====================================================
// app/api/wallet-addresses/route.ts
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

    log("AUTH_START");

    const auth =
      await requireAuth(request);

    log("AUTH_SUCCESS", {
      userId: auth.userId,
    });

    log("LOAD_ADDRESSES_START", {
      userId: auth.userId,
    });

    const data =
      await listWalletAddressesFlow(
        auth.userId
      );

    log("LOAD_ADDRESSES_SUCCESS", {
      userId: auth.userId,
      total: Array.isArray(data)
        ? data.length
        : 0,
    });

    log("GET_SUCCESS");

    return NextResponse.json(data);

  } catch (
    error
  ) {

    err("GET_FAILED", error);

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

}

/* =====================================================
   POST
===================================================== */

export async function POST(
  request: NextRequest
) {

  log("POST_START");

  try {

    log("AUTH_START");

    const auth =
      await requireAuth(request);

    log("AUTH_SUCCESS", {
      userId: auth.userId,
    });

    log("BODY_START");

    const body =
      await request.json();

    log("BODY_SUCCESS", {
      hasAddress:
        typeof body?.address === "string",

      hasLabel:
        typeof body?.label === "string",

      network:
        body?.network ?? "PI",
    });

    log("CREATE_FLOW_START", {
      userId: auth.userId,
    });

    const data =
      await createWalletAddressFlow({

        userId:
          auth.userId,

        body,

      });

    log("CREATE_FLOW_SUCCESS", {
      userId: auth.userId,

      walletAddressId:
        data?.id ??
        null,

      validationStatus:
        data?.validation_status ??
        null,

      verified:
        data?.is_verified ??
        null,
    });

    log("POST_SUCCESS");

    return NextResponse.json(data);

  } catch (
    error
  ) {

    err("POST_FAILED", error);

    return NextResponse.json(
      {
        error:
          "CREATE_FAILED",
      },
      {
        status: 500,
      }
    );

  }

}
