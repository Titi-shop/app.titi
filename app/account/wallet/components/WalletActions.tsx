// =====================================================
// app/account/wallet/components/WalletActions.tsx
// =====================================================

"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  MapPinned,
  ShieldCheck,
  History,
} from "lucide-react";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

/* =====================================================
   TYPES
===================================================== */

type Props = {
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onPay?: () => void;

  onAddresses?: () => void;
  onSecurity?: () => void;
  onHistory?: () => void;
};

/* =====================================================
   COMPONENT
===================================================== */

export default function WalletActions({
  onDeposit,
  onWithdraw,
  onPay,

  onAddresses,
  onSecurity,
  onHistory,
}: Props) {

  const { t } =
    useTranslation();

  return (

    <div
      className="
        relative z-10
        mt-8
        grid grid-cols-3 gap-3
        gap-3
      "
    >

      {/* DEPOSIT */}

      <button
        type="button"
        onClick={onDeposit}
        className="
          rounded-2xl
          border border-white/15
          bg-white/10
          p-3
          backdrop-blur-md
          transition-all
          active:scale-95
        "
      >

        <div
          className="
            mx-auto
            flex h-11 w-11
            items-center
            justify-center
            rounded-xl
            bg-white/15
          "
        >

          <ArrowDownLeft
            size={20}
          />

        </div>

        <p
          className="
            mt-2
            text-xs
            font-semibold
          "
        >
          {t.wallet_deposit ??
            "Deposit"}
        </p>

      </button>

      {/* WITHDRAW */}

      <button
        type="button"
        onClick={onWithdraw}
        className="
          rounded-2xl
          border border-white/15
          bg-white/10
          p-3
          backdrop-blur-md
          transition-all
          active:scale-95
        "
      >

        <div
          className="
            mx-auto
            flex h-11 w-11
            items-center
            justify-center
            rounded-xl
            bg-white/15
          "
        >

          <ArrowUpRight
            size={20}
          />

        </div>

        <p
          className="
            mt-2
            text-xs
            font-semibold
          "
        >
          {t.wallet_withdraw ??
            "Withdraw"}
        </p>

      </button>

      {/* PAY */}

      <button
        type="button"
        onClick={onPay}
        className="
          rounded-2xl
          border border-white/15
          bg-white/10
          p-3
          backdrop-blur-md
          transition-all
          active:scale-95
        "
      >

        <div
          className="
            mx-auto
            flex h-11 w-11
            items-center
            justify-center
            rounded-xl
            bg-white/15
          "
        >

          <CreditCard
            size={20}
          />

        </div>

        <p
          className="
            mt-2
            text-xs
            font-semibold
          "
        >
          {t.wallet_pay ??
            "Pay"}
        </p>

      </button>
{/* ADDRESS */}

<button
  type="button"
  onClick={onAddresses}
  className="
    rounded-2xl
    border border-white/15
    bg-white/10
    p-3
    backdrop-blur-md
    transition-all
    active:scale-95
  "
>

  <div
    className="
      mx-auto
      flex h-11 w-11
      items-center
      justify-center
      rounded-xl
      bg-white/15
    "
  >
    <MapPinned size={20} />
  </div>

  <p
    className="
      mt-2
      text-xs
      font-semibold
    "
  >
    Wallet
  </p>

</button>

{/* SECURITY */}

<button
  type="button"
  onClick={onSecurity}
  className="
    rounded-2xl
    border border-white/15
    bg-white/10
    p-3
    backdrop-blur-md
    transition-all
    active:scale-95
  "
>

  <div
    className="
      mx-auto
      flex h-11 w-11
      items-center
      justify-center
      rounded-xl
      bg-white/15
    "
  >
    <ShieldCheck size={20} />
  </div>

  <p
    className="
      mt-2
      text-xs
      font-semibold
    "
  >
    Security
  </p>

</button>

{/* HISTORY */}

<button
  type="button"
  onClick={onHistory}
  className="
    rounded-2xl
    border border-white/15
    bg-white/10
    p-3
    backdrop-blur-md
    transition-all
    active:scale-95
  "
>

  <div
    className="
      mx-auto
      flex h-11 w-11
      items-center
      justify-center
      rounded-xl
      bg-white/15
    "
  >
    <History size={20} />
  </div>

  <p
    className="
      mt-2
      text-xs
      font-semibold
    "
  >
    History
  </p>

</button>
    </div>

  );

}
