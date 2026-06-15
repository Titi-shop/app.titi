// =====================================================
// app/account/wallet/components/WalletWithdrawModal.tsx
// =====================================================

"use client";

import {
  Loader2,
  Wallet,
} from "lucide-react";

import {
  useState,
} from "react";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

import {
  createWithdraw,
} from "../wallet.withdraw";

/* =====================================================
   TYPES
===================================================== */

type Props = {
  open: boolean;

  onClose: () => void;

  onSuccess: () => Promise<void>;
};

/* =====================================================
   COMPONENT
===================================================== */

export default function WalletWithdrawModal({
  open,
  onClose,
  onSuccess,
}: Props) {

  const { t } =
    useTranslation();

  const [
    amount,
    setAmount,
  ] = useState("");

  const [
    withdrawWallet,
    setWithdrawWallet,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* ===================================================
     HIDE
  =================================================== */

  if (!open) {
    return null;
  }

  /* ===================================================
     SUBMIT
  =================================================== */

  async function handleSubmit() {

    try {

      setLoading(true);

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
          "Invalid amount"
        );

        return;
      }

      if (
        !withdrawWallet.trim()
      ) {

        setError(
          "Wallet address required"
        );

        return;
      }

      await createWithdraw({
        amount:
          parsedAmount,

        withdrawWallet:
          withdrawWallet.trim(),
      });

      setAmount("");

      setWithdrawWallet("");

      await onSuccess();

      onClose();

    } catch {

      setError(
        "Withdraw failed"
      );

    } finally {

      setLoading(false);
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
        bg-black/50
        backdrop-blur-sm
      "
    >

      {/* BACKDROP */}

      <button
        type="button"
        onClick={onClose}
        className="
          absolute inset-0
        "
      />

      {/* SHEET */}

      <div
        className="
          relative z-10
          w-full
          rounded-t-[2rem]
          bg-[var(--card-bg)]
          p-5
          shadow-2xl
        "
      >

        {/* HANDLE */}

        <div
          className="
            mx-auto mb-5
            h-1.5 w-14
            rounded-full
            bg-[var(--border-color)]
          "
        />

        {/* HEADER */}

        <div className="flex items-center gap-3">

          <div
            className="
              flex h-12 w-12
              items-center justify-center
              rounded-2xl
              bg-orange-500/10
              text-orange-500
            "
          >
            <Wallet size={22} />
          </div>

          <div>

            <h2
              className="
                text-lg font-bold
                text-[var(--foreground)]
              "
            >
              {t.wallet_withdraw ??
                "Withdraw"}
            </h2>

            <p
              className="
                text-sm
                text-[var(--text-muted)]
              "
            >
              Withdraw PI
              to another wallet
            </p>

          </div>

        </div>

        {/* ERROR */}

        {error && (

          <div
            className="
              mt-5 rounded-2xl
              border border-red-500/10
              bg-red-500/5
              px-4 py-3
              text-sm
              text-red-500
            "
          >
            {error}
          </div>
        )}

        {/* WALLET */}

        <div className="mt-5">

          <p
            className="
              mb-2 text-sm
              text-[var(--text-muted)]
            "
          >
            Wallet Address
          </p>

          <input
            type="text"
            value={withdrawWallet}
            onChange={(e) => {
              setWithdrawWallet(
                e.target.value
              );
            }}
            placeholder="Pi Wallet Address"
            className="
              w-full rounded-2xl
              border border-orange-500/10
              bg-[var(--background)]
              px-4 py-3
              text-sm
              outline-none
            "
          />

        </div>

        {/* AMOUNT */}

        <div className="mt-4">

          <p
            className="
              mb-2 text-sm
              text-[var(--text-muted)]
            "
          >
            Amount
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
              w-full rounded-2xl
              border border-orange-500/10
              bg-[var(--background)]
              px-4 py-3
              text-sm
              outline-none
            "
          />

        </div>

        {/* ACTIONS */}

        <div className="mt-6 flex gap-3">

          {/* CANCEL */}

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="
              flex-1 rounded-2xl
              border border-orange-500/10
              py-3 text-sm
              font-semibold
              text-[var(--foreground)]
              transition-all
              active:scale-95
            "
          >
            Cancel
          </button>

          {/* SUBMIT */}

          <button
            type="button"
            disabled={loading}
            onClick={() => {
              void handleSubmit();
            }}
            className="
              flex flex-1
              items-center
              justify-center
              gap-2
              rounded-2xl
              bg-orange-500
              py-3 text-sm
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
              ? "Processing..."
              : "Withdraw"}

          </button>

        </div>

      </div>

    </div>
  );
}
