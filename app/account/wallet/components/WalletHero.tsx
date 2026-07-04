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

import WalletDefaultAddress
  from "./WalletDefaultAddress";

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
import {
  useRouter,
} from "next/navigation";
/* =====================================================
   TYPES
===================================================== */

type Props = {
  balance: number;

  refreshing: boolean;
  defaultWallet?:
    WalletAddress | null;
  onSecurity?: () => void;
onHistory?: () => void;
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
  onSecurity,
  onHistory,
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

<div className="mt-6">

  <WalletDefaultAddress
    wallet={
      defaultWallet
        ? {
            address: defaultWallet.address,
            network: defaultWallet.network,
            is_verified:
              defaultWallet.isVerified,
          }
        : null
    }
  />

</div>
        {/* ======================================
            ACTIONS
        ====================================== */}

        <div className="mt-6">

     <WalletActions
  onWithdraw={onWithdraw}
  onAddresses={onWalletClick}
  onSecurity={onSecurity}
  onHistory={onHistory}
/>

        </div>
      </div>
    </section>

  );

}
