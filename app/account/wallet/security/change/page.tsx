// =====================================================
// app/account/wallet/security/change/page.tsx
// =====================================================

"use client";

import { useState,useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  Lock,
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

export default function WalletChangePinPage() {

  const router =
    useRouter();

  const { t } =
    useTranslation();

  const [
    currentPin,
    setCurrentPin,
  ] = useState("");

  const [
    newPin,
    setNewPin,
  ] = useState("");

  const [
    confirmPin,
    setConfirmPin,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");
const {
  user,
  loading: authLoading,
} = useAuth();
  useEffect(() => {

  if (authLoading) {
    return;
  }

  if (!user) {
    router.replace("/");
  }

}, [
  authLoading,
  user,
  router,
]);
  /* ===================================================
     SUBMIT
  =================================================== */

  async function handleSubmit() {

    setError("");

    if (
      !/^\d{6}$/.test(
        currentPin
      )
    ) {

      setError(
        "Current PIN must contain 6 digits."
      );

      return;

    }

    if (
      !/^\d{6}$/.test(
        newPin
      )
    ) {

      setError(
        "New PIN must contain 6 digits."
      );

      return;

    }

    if (
      newPin !==
      confirmPin
    ) {

      setError(
        "PIN confirmation does not match."
      );

      return;

    }

    if (
      currentPin ===
      newPin
    ) {

      setError(
        "New PIN must be different."
      );

      return;

    }

    try {

      setLoading(
        true
      );

      const response =
        await apiAuthFetch(
          "/api/wallet/security/change",
          {

            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({

                currentPin,

                newPin,

              }),

          }
        );

      const json =
        await response.json();

      if (
        !response.ok
      ) {

        setError(
          json.error ??
          "CHANGE_PIN_FAILED"
        );

        return;

      }

      router.push(
        "/account/wallet/security"
      );

    } catch {

      setError(
        "NETWORK_ERROR"
      );

    } finally {

      setLoading(
        false
      );

    }

  }
  if (authLoading) {
  return null;
}

if (!user) {
  return null;
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
            Change Wallet PIN
          </h1>

          <p
            className="
              mt-1
              text-sm
              text-[var(--text-muted)]
            "
          >
            Change your wallet security PIN.
          </p>

        </div>

      </div>

      {/* CARD */}

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
            mb-6
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

          <Lock
            size={26}
          />

        </div>

        {/* CURRENT PIN */}

        <label
          className="
            text-sm
            font-semibold
            text-[var(--foreground)]
          "
        >
          Current PIN
        </label>

        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={currentPin}
          onChange={(e) => {
            setCurrentPin(
              e.target.value
            );
          }}
          className="input mt-3"
        />

        {/* NEW PIN */}

        <label
          className="
            mt-6
            block
            text-sm
            font-semibold
            text-[var(--foreground)]
          "
        >
          New PIN
        </label>

        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={newPin}
          onChange={(e) => {
            setNewPin(
              e.target.value
            );
          }}
          className="input mt-3"
        />

        {/* CONFIRM */}

        <label
          className="
            mt-6
            block
            text-sm
            font-semibold
            text-[var(--foreground)]
          "
        >
          Confirm PIN
        </label>

        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={confirmPin}
          onChange={(e) => {
            setConfirmPin(
              e.target.value
            );
          }}
          className="input mt-3"
        />
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
              text-red-500
            "
          >
            {error}
          </div>

        )}

        {/* NOTICE */}

        <div
          className="
            mt-6
            rounded-2xl
            border
            border-yellow-500/20
            bg-yellow-500/10
            p-4
            text-xs
            text-yellow-700
          "
        >

          Your wallet PIN is required when
          creating withdrawal requests.
          Choose a PIN that is difficult for
          others to guess.

        </div>

        {/* ACTION */}

        <button
          type="button"
          onClick={() => {
            void handleSubmit();
          }}
          disabled={loading}
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
            ? "Changing..."
            : "Change PIN"}

        </button>

      </div>

    </main>

  );

}
