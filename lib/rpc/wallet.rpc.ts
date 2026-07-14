// =====================================================
// lib/rpc/wallet.rpc.ts
// =====================================================

import * as StellarSdk
  from "@stellar/stellar-sdk";

/* =====================================================
   ENV
===================================================== */

function getRpcConfig() {
  const PI_HORIZON =
    process.env.PI_HORIZON_URL;

  const PI_NETWORK =
    process.env.PI_NETWORK?.trim()
      || "Pi Testnet";

  if (!PI_HORIZON) {
    throw new Error(
      "MISSING_PI_HORIZON_URL"
    );
  }

  return {
    PI_HORIZON,
    PI_NETWORK,
  };
}

/* =====================================================
   TYPES
===================================================== */

export type PiWalletVerification = {
  exists: boolean;
  address: string;
  sequence: string | null;
  balance: number | null;
  network: string;
  rpcReachable: boolean;
  raw: Record<string, unknown>;

};

/* =====================================================
   LOG
===================================================== */

function log(
  tag: string,
  data?: unknown
) {
  console.log(
    `[RPC WALLET] ${tag}`,
    data ?? ""
  );
}

function err(
  tag: string,
  data?: unknown
) {
  console.error(
    `[RPC WALLET] ${tag}`,
    data ?? ""
  );
}

/* =====================================================
   HELPERS
===================================================== */

function parseBalance(
  balances: unknown
): number | null {

  if (
    !Array.isArray(
      balances
    )
  ) {
    return null;
  }

  const native =
    balances.find(
      (item: unknown) => {

        if (
          typeof item !==
            "object" ||
          item === null
        ) {
          return false;
        }

        const assetType =
          (
            item as Record<
              string,
              unknown
            >
          ).asset_type;

        return (
          assetType ===
          "native"
        );

      }
    );

  if (
    !native ||
    typeof native !==
      "object"
  ) {
    return null;
  }

  const value =
    Number(
      (
        native as Record<
          string,
          unknown
        >
      ).balance
    );

  return Number.isFinite(
    value
  )
    ? value
    : null;

}

/* =====================================================
   VERIFY
===================================================== */

export async function verifyPiWallet(
  address: string
): Promise<PiWalletVerification> {

  const {
    PI_HORIZON,
    PI_NETWORK,
  } = getRpcConfig();

  const wallet =
    address
      .trim()
      .toUpperCase();

  log(
    "VERIFY_START",
    {
      address:
        wallet,
    }
  );

  if (!wallet) {

    err(
      "EMPTY_ADDRESS"
    );

    throw new Error(
      "INVALID_WALLET_ADDRESS"
    );

  }

  const regex =
    /^G[A-Z2-7]{55}$/;

  if (
    !regex.test(
      wallet
    )
  ) {

    err(
      "INVALID_FORMAT",
      {
        address:
          wallet,
      }
    );

    throw new Error(
      "INVALID_WALLET_ADDRESS"
    );

  }

  const startedAt =
    Date.now();

  try {

    log(
      "HORIZON_CONNECT",
      {
        horizon:
          PI_HORIZON,
      }
    );

    const server =
      new StellarSdk
        .Horizon
        .Server(
          PI_HORIZON
        );

    log(
      "LOAD_ACCOUNT_START",
      {
        address:
          wallet,
      }
    );

    const account =
      await server.loadAccount(
        wallet
      );

    log(
      "LOAD_ACCOUNT_DONE",
      {
        durationMs:
          Date.now() -
          startedAt,
      }
    );

    const sequence =
      account.sequenceNumber();

    const balance =
      parseBalance(
        account.balances
      );

    log(
      "VERIFY_SUCCESS",
      {
        address:
          wallet,

        sequence,

        balance,
      }
    );

    return {

      exists: true,

      address:
        wallet,

      sequence,

      balance,

      network:
        PI_NETWORK,

      rpcReachable:
        true,

      raw:
        {
          balances:
            account.balances,
        },

    };

  } catch (error) {

    function getStatusCode(
  error: unknown
): number | null {

  if (
    typeof error !== "object" ||
    error === null
  ) {
    return null;
  }

  const response =
    (
      error as {
        response?: {
          status?: number;
        };
      }
    ).response;

  return typeof response?.status === "number"
    ? response.status
    : null;

}
    if (
  status === 400 ||
  status === 404
) {

      log(
        "ACCOUNT_NOT_FOUND",
        {
          address:
            wallet,
        }
      );

      return {

        exists:
          false,

        address:
          wallet,

        sequence:
          null,

        balance:
          null,

        network:
          PI_NETWORK,

        rpcReachable:
          true,

        raw:
  typeof error === "object" &&
  error !== null
    ? (
        error as Record<
          string,
          unknown
        >
      )
    : {},

      };

    }

    err(
      "VERIFY_FAILED",
      error
    );

    return {

      exists:
        false,

      address:
        wallet,

      sequence:
        null,

      balance:
        null,

      network:
        PI_NETWORK,

      rpcReachable:
        false,

      raw:
  typeof error === "object" &&
  error !== null
    ? (
        error as Record<
          string,
          unknown
        >
      )
    : {},

    };

  }

}
