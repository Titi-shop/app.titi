// =====================================================
// app/account/wallet/components/WalletHero.tsx
// =====================================================

"use client";

import {
  Eye,
  EyeOff,
  RefreshCcw,
  ChevronRight,
} from "lucide-react";

import {
  useState,
} from "react";

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

  const [
    hideBalance,
    setHideBalance,
  ] = useState(false);

  return (

    <section
      className="
        relative
        overflow-hidden
        rounded-[2rem]
        bg-gradient-to-br
        from-orange-500
        via-orange-500
        to-amber-500
        p-5
        shadow-large
      "
    >

      {/* ==========================================
          BACKGROUND GLOW
      ========================================== */}

      <div
        className="
          absolute
          -right-16
          -top-16
          h-52
          w-52
          rounded-full
          bg-white/10
          blur-3xl
        "
      />

      <div
        className="
          absolute
          -left-10
          bottom-0
          h-40
          w-40
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

        {/* ======================================
            HEADER
        ====================================== */}

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
                font-medium
                text-white/80
              "
            >
              {t.wallet_available_balance ??
                t.wallet_balance ??
                "Available Balance"}
            </p>

            <div
              className="
                mt-3
                flex
                items-center
                gap-3
              "
            >

              <h1
                className="
                  text-4xl
                  font-black
                  tracking-tight
                  text-white
                "
              >
                {hideBalance
                  ? "••••••"
                  : `π ${formatPi(balance)}`}
              </h1>

              <button
                type="button"
                onClick={() => {
                  setHideBalance(
                    !hideBalance
                  );
                }}
                className="
                  text-white/80
                  transition
                  hover:text-white
                "
              >

                {hideBalance ? (

                  <EyeOff
                    size={18}
                  />

                ) : (

                  <Eye
                    size={18}
                  />

                )}

              </button>

            </div>

          </div>

          {/* REFRESH */}

          <button
            type="button"
            onClick={onRefresh}
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
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
        {/* ======================================
            DEFAULT WALLET
        ====================================== */}

        <button
          type="button"
          onClick={onWalletClick}
          className="
            mt-6
            flex
            w-full
            items-center
            justify-between
            rounded-2xl
            border
            border-white/20
            bg-white/10
            p-4
            backdrop-blur-md
            transition-all
            active:scale-[0.98]
          "
        >

          {/* LEFT */}

          <div
            className="
              min-w-0
              flex-1
            "
          >

            <p
              className="
                text-xs
                text-white/70
              "
            >
              {t.wallet_default ??
                "Default Wallet"}
            </p>

            <div
              className="
                mt-2
                flex
                items-center
                gap-2
              "
            >

              <p
                className="
                  truncate
                  text-base
                  font-bold
                  tracking-wide
                  text-white
                "
              >

                {defaultWallet
                  ? defaultWallet.address.slice(0, 6) +
                    "..." +
                    defaultWallet.address.slice(-6)
                  : (
                      t.wallet_not_linked ??
                      "No wallet linked"
                    )}

              </p>

              {defaultWallet?.isVerified && (

                <span
                  className="
                    rounded-full
                    bg-green-500/20
                    px-2
                    py-0.5
                    text-[11px]
                    font-semibold
                    text-green-100
                  "
                >
                  {t.wallet_verified ??
                    "Verified"}
                </span>

              )}

              {defaultWallet &&
                !defaultWallet.isVerified && (

                <span
                  className="
                    rounded-full
                    bg-yellow-500/20
                    px-2
                    py-0.5
                    text-[11px]
                    font-semibold
                    text-yellow-100
                  "
                >
                  {t.wallet_unverified ??
                    "Unverified"}
                </span>

              )}

            </div>

            <p
              className="
                mt-2
                text-xs
                text-white/70
              "
            >
              {defaultWallet?.network ??
                "Pi Network"}
            </p>

          </div>

          {/* RIGHT */}

          <div
            className="
              ml-4
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              bg-white/10
            "
          >

            <ChevronRight
              size={18}
              className="
                text-white
              "
            />

          </div>

        </button>
        {/* ======================================
            ACTIONS
        ====================================== */}

        <div className="mt-6">

          <WalletActions
  onWithdraw={onWithdraw}

  onAddresses={() => {
    onWalletClick?.();
  }}

  onSecurity={() => {
    window.location.href =
      "/account/wallet/security";
  }}

  onHistory={() => {
    window.location.href =
      "/account/wallet/history";
  }}
/>

        </div>
      </div>
    </section>

  );

}
