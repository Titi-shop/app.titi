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

import WalletActions
  from "./WalletActions";
import WalletDefaultAddress
  from "./WalletDefaultAddress";
import {
  formatPi,
} from "../wallet.utils";

/* =====================================================
   TYPES
===================================================== */

type Props = {
  balance: number;
  refreshing: boolean;
  defaultWallet?: {
    address: string;
    verified: boolean;
  } | null;

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
        relative overflow-hidden
        rounded-b-[2.5rem]
        border-b border-orange-500/10
        bg-gradient-to-br
        from-orange-500
        via-orange-500
        to-amber-500
        px-5 pb-8 pt-8
        text-white
        shadow-xl
      "
    >

      {/* glow */}

      <div
        className="
          absolute -right-10 -top-10
          h-40 w-40 rounded-full
          bg-white/10 blur-3xl
        "
      />

      <div
        className="
          absolute bottom-0 left-0
          h-32 w-32 rounded-full
          bg-yellow-300/10 blur-3xl
        "
      />

      {/* TOP */}

      <div
        className="
          relative z-10 flex items-start
          justify-between gap-4
        "
      >

        <div>

          <p className="text-sm text-white/80">
            {t.wallet_balance ??
              "Wallet Balance"}
          </p>

          <h1
            className="
              mt-3 text-4xl
              font-black tracking-tight
            "
          >
            π {formatPi(balance)}
          </h1>

        </div>
{/* DEFAULT WALLET */}

<WalletDefaultAddress
  wallet={
    defaultWallet
      ? {
          address:
            defaultWallet.address,
          network: "PI",
          is_verified:
            defaultWallet.verified,
        }
      : null
  }
  onClick={onWalletClick}
/>
        {/* DEFAULT WALLET */}

<button
  type="button"
  onClick={onWalletClick}
  className="
    relative z-10
    mt-6
    w-full
    rounded-2xl
    border
    border-white/20
    bg-white/10
    p-4
    backdrop-blur-md
    transition
    active:scale-[0.98]
  "
>

  <div
    className="
      flex
      items-center
      justify-between
      gap-4
    "
  >

    <div>

      <p
        className="
          text-xs
          text-white/70
        "
      >
        Ví mặc định
      </p>

      <p
        className="
          mt-1
          font-semibold
          tracking-wide
        "
      >
        {defaultWallet
          ? defaultWallet.address
          : "Chưa có ví"}
      </p>

      {defaultWallet && (

        <span
          className="
            mt-2
            inline-flex
            rounded-full
            bg-green-500/20
            px-2.5
            py-1
            text-[11px]
            font-medium
            text-green-100
          "
        >

          {defaultWallet.verified
            ? "Đã xác minh"
            : "Chưa xác minh"}

        </span>

      )}

    </div>

    <span
      className="
        text-xl
        text-white/70
      "
    >
      ›
    </span>

  </div>

</button>

      </div>

      {/* ACTIONS */}

      <WalletActions
        onWithdraw={
          onWithdraw
        }
      />

    </section>
  );
}
