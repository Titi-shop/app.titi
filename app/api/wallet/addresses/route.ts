// =====================================================
// app/api/wallet/addresses/route.ts
// =====================================================

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireAuth,
} from "@/lib/auth/guard";

import {
  getWalletAddressesByUser,
  createWalletAddress,
} from "@/lib/db/wallet-addresses";

export const runtime =
  "nodejs";

/* =====================================================
   GET
===================================================== */

export async function GET() {

  try {

    const auth =
      await requireAuth();

    if (!auth.ok) {
      return auth.response;
    }

   const wallets =
  await getWalletAddressesByUser(
    auth.userId
  );

    return NextResponse.json({
      wallets,
    });

  } catch (error) {

    console.error(
      "[WALLET_ADDRESSES][GET_FAILED]",
      {
        error:
          error instanceof Error
            ? error.message
            : "UNKNOWN_ERROR",
      }
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

  try {

    const auth =
      await requireAuth();

    if (!auth.ok) {
      return auth.response;
    }

    const body =
      await request.json();

    const address =
      typeof body?.address ===
      "string"
        ? body.address.trim()
        : "";

    if (!address) {

      return NextResponse.json(
        {
          error:
            "INVALID_ADDRESS",
        },
        {
          status: 400,
        }
      );
    }

    const wallet =
      await createWalletAddress({

        userId:
          auth.userId,

        address,

        network:
          "PI",

      });

    return NextResponse.json(
      {
        success: true,

        wallet,
      }
    );

  } catch (error) {

    console.error(
      "[WALLET_ADDRESSES][POST_FAILED]",
      {
        error:
          error instanceof Error
            ? error.message
            : "UNKNOWN_ERROR",
      }
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
