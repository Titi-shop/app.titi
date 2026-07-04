// =====================================================
// app/api/wallet/security/route.ts
// =====================================================

import {
  NextResponse,
} from "next/server";

import {
  requireAuth,
} from "@/lib/auth/guard";

import {
  getWalletSecurity,
} from "@/lib/services/wallet-security.service";

export const runtime =
  "nodejs";

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
   GET
===================================================== */

export async function GET() {

  try {

    log(
      "GET_START"
    );

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

    const security =
      await getWalletSecurity(
        auth.userId
      );

    log(
      "SERVICE_DONE",
      {
        found:
          !!security,
      }
    );

    return NextResponse.json({

  success: true,

  pin_enabled:
    security?.pin_enabled ??
    false,

  totp_enabled:
    security?.totp_enabled ??
    false,

  biometric_enabled:
    security?.biometric_enabled ??
    false,

  passkey_enabled:
    security?.passkey_enabled ??
    false,

  locked:
    !!(
      security?.locked_until &&
      new Date(
        security.locked_until
      ) > new Date()
    ),

});

  } catch (error) {

    err(
      "GET_FAILED",
      error
    );

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
