// =====================================================
// app/account/wallet/wallet.withdraw.ts
// =====================================================

import {
  apiAuthFetch,
} from "@/lib/api/apiAuthFetch";

import type {
  WithdrawPayload,
  WithdrawResponse,
} from "./wallet.types";

/* =====================================================
   CREATE WITHDRAW
===================================================== */

export async function createWithdraw(
  payload: WithdrawPayload
): Promise<WithdrawResponse> {

  /* ===================================================
     VALIDATE AMOUNT
  =================================================== */

  if (
    Number.isNaN(
      payload.amount
    ) ||
    payload.amount <= 0
  ) {

    return {
      success: false,
      error:
        "INVALID_AMOUNT",
    };
  }

  /* ===================================================
     VALIDATE WALLET
  =================================================== */

  const walletAddressId =
    payload.walletAddressId
      .trim();

  if (
    !walletAddressId
  ) {

    return {
      success: false,
      error:
        "INVALID_WALLET",
    };
  }

  try {

    /* =================================================
       REQUEST
    ================================================= */

    const response =
      await apiAuthFetch(
        "/api/wallet/withdraw",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              amount:
                payload.amount,

              walletAddressId,
            }),
        }
      );

    /* =================================================
       PARSE RESPONSE
    ================================================= */

    const json:
      unknown =
        await response.json();

    if (
      typeof json !==
        "object" ||
      json === null
    ) {

      return {
        success: false,
        error:
          "INVALID_RESPONSE",
      };
    }

    const data =
      json as Record<
        string,
        unknown
      >;

    /* =================================================
       FAILED
    ================================================= */

    if (
      !response.ok
    ) {

      return {
        success: false,

        error:
          typeof data.error ===
          "string"
            ? data.error
            : "WITHDRAW_FAILED",
      };
    }

    /* =================================================
       SUCCESS
    ================================================= */

    return {

      success: true,

      withdrawalId:
        typeof data.withdrawalId ===
        "string"
          ? data.withdrawalId
          : undefined,
    };

  } catch {

    return {

      success: false,

      error:
        "NETWORK_ERROR",
    };
  }
}
