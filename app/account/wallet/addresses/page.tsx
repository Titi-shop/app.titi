// =====================================================
// app/account/wallet/addresses/page.tsx
// =====================================================

"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  Wallet,
  Loader2,
} from "lucide-react";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

import {
  apiAuthFetch,
} from "@/lib/api/apiAuthFetch";

/* =====================================================
   PAGE
===================================================== */

export default function WalletAddressesPage() {

  const router =
    useRouter();

  const { t } =
    useTranslation();

  const [
    address,
    setAddress,
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
     SAVE
  =================================================== */

  async function handleSave() {

    const wallet =
      address.trim();

    if (!wallet) {

      setError(
        t.wallet_invalid_address ??
        "Wallet address is required."
      );

      return;
    }

    try {

      setLoading(true);

      setError("");

      const response =
        await apiAuthFetch(
          "/api/wallet/addresses",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              address:
                wallet,
            }),
          }
        );

      const json =
        await response.json();

      if (!response.ok) {

        setError(
          json.error ??
          "{t.wallet_save_faile}"
        );

        return;
      }

      router.push(
        "/account/wallet"
      );

    } catch {

      setError(
        t.wallet_network_error ??
        "Network error."
      );

    } finally {

      setLoading(false);

    }
  }
    /* ===================================================
     UI
  =================================================== */

  return (
    <main
      className="
        min-h-screen
        bg-[var(--background)]
        px-5
        py-6
      "
    >

      {/* HEADER */}

      <div
        className="
          flex
          items-center
          gap-3
        "
      >

        <button
          type="button"
          onClick={() => {
            router.back();
          }}
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            border
            border-[var(--nav-border)]
            bg-[var(--card-bg)]
          "
        >

          <ArrowLeft
            size={20}
          />

        </button>

        <div>

          <h1
            className="
              text-xl
              font-bold
              text-[var(--foreground)]
            "
          >
            {t.wallet_address}
          </h1>

          <p
            className="
              mt-1
              text-sm
              text-[var(--text-muted)]
            "
          >
            {t.wallet_address_subtitle}
          </p>

        </div>

      </div>

      {/* FORM */}

      <div
        className="
          mt-8
          rounded-3xl
          border
          border-[var(--nav-border)]
          bg-[var(--card-bg)]
          p-5
        "
      >

        <div
          className="
            mb-5
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

          <Wallet
            size={26}
          />

        </div>

        <label
          className="
            text-sm
            font-semibold
            text-[var(--foreground)]
          "
        >
          {t.pi_wallet_address}
        </label>

        <input
          type="text"
          value={address}
          onChange={(e) => {
            setAddress(
              e.target.value
            );
          }}
          placeholder="G..."
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="
            mt-3
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
            transition
            focus:border-primary
          "
        />

        <p
          className="
            mt-3
            text-xs
            text-[var(--text-muted)]
          "
        >
          {t.wallet_address_hint}
        </p>

        {error && (

          <div
            className="
              mt-4
              rounded-2xl
              border
              border-red-500/20
              bg-red-500/10
              px-4
              py-3
              text-sm
              text-red-500
            "
          >
            {error}
          </div>

        )}

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            void handleSave();
          }}
          className="
            mt-6
            flex
            w-full
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
              size={18}
              className="
                animate-spin
              "
            />

          )}

          {loading
            ? "{t.saving...}"
            : "{t.save_wallet}"}

        </button>

      </div>

    </main>
  );
}
