// =====================================================
// app/account/wallet/components/WalletHero.tsx
// =====================================================

"use client";

import {
  RefreshCcw,
} from "lucide-react";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

import type {
  WalletAddress,
} from "../wallet.types";

import {
  formatPi,
} from "../wallet.utils";

import WalletActions
  from "./WalletActions";

import WalletDefaultAddress
  from "./WalletDefaultAddress";

/* =====================================================
   TYPES
===================================================== */

type Props = {
  balance: number;

  refreshing: boolean;

  defaultWallet?:
    WalletAddress | null;

  onRefresh: () => void;

  onWithdraw: () => void;

  onWalletClick?: () => void;
};

/* =====================================================
   COMPONENT
===================================================== */

export default function WalletHero({
  balance,
  refreshing,
  defaultWallet,
  onRefresh,
  onWithdraw,
  onWalletClick,
}: Props) {

  const { t } =
    useTranslation();

  return (

    <section
      className="
        relative
        overflow-hidden
        rounded-b-[2.5rem]
        border-b
        border-orange-500/10
        bg-gradient-to-br
        from-orange-500
        via-orange-500
        to-amber-500
        px-5
        pb-8
        pt-8
        text-white
        shadow-xl
      "
    >

      {/* Glow */}

      <div
        className="
          absolute
          -right-10
          -top-10
          h-40
          w-40
          rounded-full
          bg-white/10
          blur-3xl
        "
      />

      <div
        className="
          absolute
          bottom-0
          left-0
          h-32
          w-32
          rounded-full
          bg-yellow-300/10
          blur-3xl
        "
      />

      <div
        className="
          relative
          z-10
        "
      >

        {/* HEADER */}

        <div
          className="
            flex
            items-start
            justify-between
            gap-4
          "
        >

          <div>

            <p
              className="
                text-sm
                text-white/80
              "
            >
              {t.wallet_balance ??
                "Wallet Balance"}
            </p>

            <h1
              className="
                mt-3
                text-4xl
                font-black
                tracking-tight
              "
            >
              π {formatPi(balance)}
            </h1>

          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-2xl
              border
              border-white/20
              bg-white/10
              backdrop-blur-md
              transition-all
              active:scale-95
            "
          >

            <RefreshCcw
              size={18}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

          </button>

        </div>

        {/* DEFAULT WALLET */}

        <WalletDefaultAddress
          wallet={
            defaultWallet
              ? {
                  address:
                    defaultWallet.address,
                  network:
                    defaultWallet.network,
                  is_verified:
                    defaultWallet.isVerified,
                }
              : null
          }
          onClick={
            onWalletClick
          }
        />

        {/* ACTIONS */}

        <WalletActions
          onWithdraw={
            onWithdraw
          }
        />

      </div>

    </section>

  );

}
