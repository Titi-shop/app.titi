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
import {
  getWalletRecordByUserId,
} from "@/lib/db/wallet";
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
    const walletRecord =
  await getWalletRecordByUserId(
    auth.userId
  );

if (!walletRecord) {
  return NextResponse.json(
    {
      error: "WALLET_NOT_FOUND",
    },
    {
      status: 404,
    }
  );
}

    const wallet =
  await createWalletAddress({
    wallet_id: walletRecord.id,
    user_id: auth.userId,
    network: "PI",
    address,
    label: null,
    is_default: true,
    created_by: auth.userId,
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
