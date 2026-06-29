// =====================================================
// app/account/wallet/wallet.api.ts
// =====================================================

import {
  apiAuthFetch,
} from "@/lib/api/apiAuthFetch";

import type {
  WalletAddress,
  WalletBalance,
  WalletResponse,
  WalletTransaction,
  JournalEntryType,
} from "./wallet.types";

import {
  toSafeNumber,
} from "./wallet.utils";

/* =====================================================
   FETCH WALLET
===================================================== */

export async function fetchWallet():
  Promise<WalletResponse> {

  const response =
    await apiAuthFetch(
      "/api/wallet",
      {
        cache:
          "no-store",
      }
    );
const addressResponse =
  await apiAuthFetch(
    "/api/wallet/addresses",
    {
      cache: "no-store",
    }
  );
  const addressJson: unknown =
  await addressResponse.json();
  if (!response.ok) {

    return {

      balance: {
        balance: 0,
        availableBalance: 0,
        pendingBalance: 0,
        frozenBalance: 0,
      },

      transactions: [],

      wallets: [],

      defaultWallet: null,
    };
  }

  const json:
    unknown =
      await response.json();

  if (
    typeof json !== "object" ||
    json === null
  ) {

    throw new Error(
      "INVALID_WALLET_RESPONSE"
    );
  }

  const data =
    json as Record<
      string,
      unknown
    >;

  /* ===================================================
     BALANCE
  =================================================== */

  const balance:
    WalletBalance = {

    balance:
      toSafeNumber(
        data.balance
      ),

    availableBalance:
      toSafeNumber(
        data.availableBalance
      ),

    pendingBalance:
      toSafeNumber(
        data.pendingBalance
      ),

    frozenBalance:
      toSafeNumber(
        data.frozenBalance
      ),
  };

  /* ===================================================
     TRANSACTIONS
  =================================================== */

  const transactions:
    WalletTransaction[] =
      Array.isArray(
        data.transactions
      )
        ? data.transactions
            .map((item) => {

              if (
                typeof item !==
                  "object" ||
                item === null
              ) {
                return null;
              }

              const tx =
                item as Record<
                  string,
                  unknown
                >;

              return {

                id:
                  String(
                    tx.id ?? ""
                  ),

                direction:
                  tx.direction ===
                  "DEBIT"
                    ? "DEBIT"
                    : "CREDIT",

                amount:
                  toSafeNumber(
                    tx.amount
                  ),

                entryType:
                  String(
                    tx.entry_type ??
                      ""
                  ) as JournalEntryType,

                createdAt:
                  String(
                    tx.created_at ??
                      ""
                  ),

              };

            })
            .filter(
              (
                item
              ): item is WalletTransaction =>
                item !== null
            )
        : [];

  /* ===================================================
   WALLETS
=================================================== */

const addressData =
  typeof addressJson === "object" &&
  addressJson !== null
    ? (addressJson as Record<string, unknown>)
    : {};

const wallets: WalletAddress[] =
  Array.isArray(addressData.wallets)
    ? addressData.wallets
        .map((item) => {

          if (
            typeof item !== "object" ||
            item === null
          ) {
            return null;
          }

          const wallet =
            item as Record<
              string,
              unknown
            >;

          return {

            id:
              String(
                wallet.id ?? ""
              ),

            address:
              String(
                wallet.address ?? ""
              ),

            network:
              String(
                wallet.network ?? ""
              ),

            label:
              typeof wallet.label ===
              "string"
                ? wallet.label
                : null,

            isDefault:
              Boolean(
                wallet.is_default
              ),

            isVerified:
              Boolean(
                wallet.is_verified
              ),

          };

        })
        .filter(
          (
            item
          ): item is WalletAddress =>
            item !== null
        )
    : [];

  /* ===================================================
     DEFAULT WALLET
  =================================================== */

  const defaultWallet =
    wallets.find(
      (
        wallet
      ) =>
        wallet.isDefault
    ) ??
    null;

  /* ===================================================
     RETURN
  =================================================== */

  return {

    balance,

    transactions,

    wallets,

    defaultWallet,

  };

}
