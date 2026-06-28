// =====================================================
// app/account/wallet/components/WalletWithdrawModal.tsx
// =====================================================

"use client";

import {
  Loader2,
  Wallet,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

import {
  createWithdraw,
} from "../wallet.withdraw";

import type {
  WalletAddress,
} from "../wallet.types";

import WalletAddressCard
  from "./WalletAddressCard";

import WalletAddressSheet
  from "./WalletAddressSheet";

/* =====================================================
   TYPES
===================================================== */

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  wallets: WalletAddress[];
  defaultWallet: WalletAddress | null;
};

/* =====================================================
   COMPONENT
===================================================== */

export default function WalletWithdrawModal({
  open,
  onClose,
  onSuccess,
  wallets,
  defaultWallet,
}: Props) {

  const { t } =
    useTranslation();

  const [
    amount,
    setAmount,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    selectedWallet,
    setSelectedWallet,
  ] = useState<WalletAddress | null>(
    null
  );

  const [
    walletSheetOpen,
    setWalletSheetOpen,
  ] = useState(false);

  /* ===================================================
     RESET
  =================================================== */

  useEffect(() => {

    if (!open) {
      return;
    }

    setAmount("");

    setError("");

    setSelectedWallet(
      defaultWallet
    );

  }, [
    open,
    defaultWallet,
  ]);

  /* ===================================================
     HIDE
  =================================================== */

  if (!open) {
    return null;
  }

  /* ===================================================
     ERROR MESSAGE
  =================================================== */

  function getErrorMessage(
    code?: string
  ) {

    switch (code) {

      case "INVALID_AMOUNT":

        return (
          t.wallet_invalid_amount ??
          "Invalid amount"
        );

      case "INVALID_WALLET":

        return (
          t.wallet_invalid_wallet ??
          "Invalid wallet"
        );

      case "INSUFFICIENT_BALANCE":

        return (
          t.wallet_insufficient_balance ??
          "Insufficient balance"
        );

      case "WITHDRAW_DISABLED":

        return (
          t.wallet_withdraw_disabled ??
          "Withdraw disabled"
        );

      case "NETWORK_ERROR":

        return (
          t.wallet_network_error ??
          "Network error"
        );

      default:

        return (
          t.wallet_withdraw_failed ??
          "Withdraw failed"
        );
    }
  }

  /* ===================================================
     SUBMIT
  =================================================== */

  async function handleSubmit() {

    setError("");

    const parsedAmount =
      Number(amount);

    if (
      Number.isNaN(
        parsedAmount
      ) ||
      parsedAmount <= 0
    ) {

      setError(
        getErrorMessage(
          "INVALID_AMOUNT"
        )
      );

      return;
    }

    if (
      !selectedWallet
    ) {

      setError(
        getErrorMessage(
          "INVALID_WALLET"
        )
      );

      return;
    }

    try {

      setLoading(true);

      const result =
        await createWithdraw({

          amount:
            parsedAmount,

          walletAddressId:
            selectedWallet.id,

        });

      if (
        !result.success
      ) {

        setError(
          getErrorMessage(
            result.error
          )
        );

        return;
      }

      await onSuccess();

      onClose();

    } finally {

      setLoading(
        false
      );
    }

  }

  /* ===================================================
     UI
  =================================================== */

  
  return (
    <div
      className="
        fixed inset-0 z-50
        flex items-end
        bg-black/60
        backdrop-blur-sm
      "
    >

      {/* BACKDROP */}

      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
      />

      {/* ADDRESS SHEET */}

      <WalletAddressSheet
        open={walletSheetOpen}
        wallets={wallets}
        selected={selectedWallet}
        onSelect={setSelectedWallet}
        onClose={() => {
          setWalletSheetOpen(false);
        }}
      />

      {/* SHEET */}

      <div
        className="
          relative z-10
          w-full
          rounded-t-[2rem]
          border-t
          border-[var(--nav-border)]
          bg-[var(--card-bg)]
          p-5
          pb-[calc(env(safe-area-inset-bottom)+90px)]
          shadow-2xl
        "
      >

        {/* HANDLE */}

        <div
          className="
            mx-auto
            mb-6
            h-1.5
            w-14
            rounded-full
            bg-[var(--nav-border)]
          "
        />

        {/* HEADER */}

        <div className="flex items-center gap-4">

          <div
            className="
              flex
              h-14
              w-14
              items-center
              justify-center
              rounded-2xl
              bg-primary/10
              text-primary
            "
          >
            <Wallet size={24} />
          </div>

          <div className="flex-1">

            <h2
              className="
                text-xl
                font-bold
                text-[var(--foreground)]
              "
            >
              {t.wallet_withdraw ??
                "Withdraw"}
            </h2>

            <p
              className="
                mt-1
                text-sm
                text-[var(--text-muted)]
              "
            >
              {t.wallet_withdraw_description ??
                "Withdraw PI to another wallet"}
            </p>

          </div>

        </div>

        {/* ERROR */}

        {error && (

          <div
            className="
              mt-5
              rounded-2xl
              border
              border-red-500/20
              bg-red-500/10
              px-4
              py-3
              text-sm
              font-medium
              text-red-500
            "
          >
            {error}
          </div>

        )}

        {/* WALLET */}

        <div className="mt-6">

          <p
            className="
              mb-2
              text-sm
              font-medium
              text-[var(--foreground)]
            "
          >
            {t.wallet_address ??
              "Wallet Address"}
          </p>

          <WalletAddressCard
            wallet={selectedWallet}
            onClick={() => {
              setWalletSheetOpen(true);
            }}
          />

        </div>

        {/* AMOUNT */}

        <div className="mt-6">

          <p
            className="
              mb-2
              text-sm
              font-medium
              text-[var(--foreground)]
            "
          >
            {t.wallet_amount ??
              "Amount"}
          </p>

          <input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(
                e.target.value
              );
            }}
            placeholder="0.00"
            className="
              w-full
              rounded-2xl
              border
              border-[var(--nav-border)]
              bg-[var(--background)]
              px-4
              py-3.5
              text-sm
              text-[var(--foreground)]
              outline-none
              transition-all
              placeholder:text-[var(--text-muted)]
              focus:border-primary
              focus:ring-2
              focus:ring-primary/10
            "
          />

        </div>

        {/* NOTICE */}

        <div
          className="
            mt-5
            rounded-2xl
            border
            border-yellow-500/20
            bg-yellow-500/10
            p-3
            text-xs
            text-yellow-600
          "
        >
          Withdrawal requests are reviewed manually.
          Funds are not transferred instantly.
        </div>

        {/* ACTIONS */}

        <div className="mt-6 flex gap-3">

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="
              flex-1
              rounded-2xl
              border
              border-[var(--nav-border)]
              bg-[var(--card-secondary)]
              py-3.5
              text-sm
              font-semibold
              text-[var(--foreground)]
              transition-all
              active:scale-95
              disabled:opacity-60
            "
          >
            {t.common_cancel ??
              "Cancel"}
          </button>

          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={loading}
            className="
              flex
              flex-1
              items-center
              justify-center
              gap-2
              rounded-2xl
              bg-primary
              py-3.5
              text-sm
              font-semibold
              text-white
              transition-all
              active:scale-95
              disabled:opacity-60
            "
          >

            {loading && (
              <Loader2
                size={16}
                className="animate-spin"
              />
            )}

            {loading
              ? (
                t.common_processing ??
                "Processing..."
              )
              : (
                t.wallet_withdraw ??
                "Withdraw"
              )}

          </button>

        </div>

      </div>

    </div>
  );

}
    
