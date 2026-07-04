// =====================================================
// app/account/wallet/components/WalletHero.tsx
// =====================================================

"use client";

import {
  Eye,
  EyeOff,
} from "lucide-react";

import {
  useEffect,
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
useEffect(() => {

  const saved =
    window.localStorage.getItem(
      "wallet_hide_balance"
    );

  if (saved !== null) {

    setHideBalance(
      saved === "true"
    );

  }

}, []);
  useEffect(() => {

  window.localStorage.setItem(
    "wallet_hide_balance",
    String(hideBalance)
  );

}, [hideBalance]);
  
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
      (prev) => !prev
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
        </div>
      {/* ======================================
    DEFAULT WALLET
====================================== */}

<div className="mt-3">

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

        <div className="mt-3">

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
