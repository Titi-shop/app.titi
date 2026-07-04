// =====================================================
// app/account/wallet/security/setup/page.tsx
// =====================================================

"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

import {
  apiAuthFetch,
} from "@/lib/api/apiAuthFetch";
import { useAuth } from "@/context/AuthContext";

/* =====================================================
   CONSTANTS
===================================================== */

const PIN_LENGTH =
  6;

/* =====================================================
   PAGE
===================================================== */

export default function WalletPinSetupPage() {

  const router =
    useRouter();

  const { t } =
    useTranslation();
const {
  user,
  loading: authLoading,
} = useAuth();
  
  /* ===================================================
     STATE
  =================================================== */

  const [
    step,
    setStep,
  ] = useState<
    "create" |
    "confirm"
  >(
    "create"
  );

  const [
    pin,
    setPin,
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

  /* ===================================================
     CURRENT PIN
  =================================================== */
useEffect(() => {

  if (authLoading || !user) {
    return;
  }

  void checkPin();

}, [
  authLoading,
  user,
]);
  const currentPin =
    step === "create"
      ? pin
      : confirmPin;

  /* ===================================================
     TITLE
  =================================================== */

  const title =
    useMemo(
      () => {

        if (
          step ===
          "create"
        ) {

          return (
            t.wallet_create_pin ??
            "Create Wallet PIN"
          );

        }

        return (
          t.wallet_confirm_pin ??
          "Confirm Wallet PIN"
        );

      },
      [
        step,
        t,
      ]
    );

  /* ===================================================
     SUB TITLE
  =================================================== */

  const subtitle =
    useMemo(
      () => {

        if (
          step ===
          "create"
        ) {

          return (
            t.wallet_create_pin_hint ??
            "Create a 6-digit PIN to protect your wallet."
          );

        }

        return (
          t.wallet_confirm_pin_hint ??
          "Enter your PIN again to confirm."
        );

      },
      [
        step,
        t,
      ]
    );

  /* ===================================================
     HELPERS
  =================================================== */

  function clearError() {

    setError("");

  }

  function resetAll() {

    setPin("");

    setConfirmPin("");

    setStep(
      "create"
    );

    setError("");

  }
  async function checkPin() {

  try {

    const response =
      await apiAuthFetch(
        "/api/wallet/security"
      );

    if (!response.ok) {
      return;
    }

    const json =
      await response.json();

    if (json.security?.pin_enabled) {

      router.replace(
        "/account/wallet/security/change"
      );

    }

  } catch {

    // ignore

  }

}
  /* ===================================================
     SAVE PIN
  =================================================== */

  async function savePin(
    value: string
  ) {

    try {

      setLoading(
        true
      );

      clearError();

      const response =
        await apiAuthFetch(

          "/api/wallet/security/setup",

          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json",

            },

            body:
              JSON.stringify({

                pin:
                  value,

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

          (
            t.wallet_pin_create_failed ??

            "Unable to create PIN."

          )

        );

        return;

      }

      router.replace(
        "/account/wallet"
      );

    } catch {

      setError(

        t.wallet_network_error ??

        "Network error."

      );

    } finally {

      setLoading(
        false
      );

    }

  }

  /* ===================================================
     INPUT NUMBER
  =================================================== */

  async function inputNumber(
    number: string
  ) {

    if (
      loading
    ) {

      return;

    }

    clearError();

    /* ===========================
       CREATE
    =========================== */

    if (
      step ===
      "create"
    ) {

      if (
        pin.length >=
        PIN_LENGTH
      ) {

        return;

      }

      const next =
        pin + number;

      setPin(
        next
      );

      if (
        next.length ===
        PIN_LENGTH
      ) {

        setTimeout(
          () => {

            setStep(
              "confirm"
            );

          },
          150
        );

      }

      return;

    }

    /* ===========================
       CONFIRM
    =========================== */

    if (
      confirmPin.length >=
      PIN_LENGTH
    ) {

      return;

    }

    const next =
      confirmPin +
      number;

    setConfirmPin(
      next
    );

    if (
      next.length !==
      PIN_LENGTH
    ) {

      return;

    }

    if (
      next !== pin
    ) {

      setTimeout(
        () => {

          setConfirmPin(
            ""
          );

          setError(

            t.wallet_pin_not_match ??

            "PIN does not match."

          );

        },
        200
      );

      return;

    }

    await savePin(
      next
    );

  }

  /* ===================================================
     DELETE NUMBER
  =================================================== */

  function deleteNumber() {

    clearError();

    if (
      loading
    ) {

      return;

    }

    if (
      step ===
      "create"
    ) {

      setPin(

        pin.slice(
          0,
          -1
        )

      );

      return;

    }

    setConfirmPin(

      confirmPin.slice(
        0,
        -1
      )

    );

  }

  /* ===================================================
     BACK
  =================================================== */

  function handleBack() {

    if (
      loading
    ) {

      return;

    }

    if (
      step ===
      "confirm"
    ) {

      setConfirmPin(
        ""
      );

      setStep(
        "create"
      );

      return;

    }

    router.back();

  }
if (authLoading) {
  return null;
}

if (!user) {
  router.replace("/");
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
          onClick={
            handleBack
          }
          disabled={
            loading
          }
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
            disabled:opacity-60
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
            {title}
          </h1>

          <p
            className="
              mt-1
              text-sm
              text-[var(--text-muted)]
            "
          >
            {subtitle}
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
          p-6
        "
      >

        {/* ICON */}

        <div
          className="
            mx-auto
            flex
            h-16
            w-16
            items-center
            justify-center
            rounded-2xl
            bg-primary/10
            text-primary
          "
        >

          <ShieldCheck
            size={30}
          />

        </div>

        {/* TITLE */}

        <h2
          className="
            mt-5
            text-center
            text-lg
            font-bold
            text-[var(--foreground)]
          "
        >
          {title}
        </h2>

        {/* SUBTITLE */}

        <p
          className="
            mt-2
            text-center
            text-sm
            text-[var(--text-muted)]
          "
        >
          {subtitle}
        </p>

        {/* PIN DOTS */}

        <div
          className="
            mt-10
            flex
            justify-center
            gap-4
          "
        >

          {

            Array.from({

              length:
                PIN_LENGTH,

            }).map(

              (
                _,
                index
              ) => (

                <div
                  key={
                    index
                  }
                  className={`
                    h-4
                    w-4
                    rounded-full
                    border-2
                    transition-all

                    ${
                      index <
                      currentPin.length

                        ? "border-primary bg-primary"

                        : "border-[var(--nav-border)] bg-transparent"

                    }
                  `}
                />

              )

            )

          }

        </div>

        {/* ERROR */}

        {error && (

          <div
            className="
              mt-8
              rounded-2xl
              border
              border-red-500/20
              bg-red-500/10
              px-4
              py-3
              text-center
              text-sm
              font-medium
              text-red-500
            "
          >
            {error}
          </div>

        )}
        {/* KEYBOARD */}

        <div
          className="
            mt-8
            grid
            grid-cols-3
            gap-3
          "
        >

          {[
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "",
            "0",
            "⌫",
          ].map(
            (
              key
            ) => {

              if (
                key === ""
              ) {

                return (
                  <div
                    key="empty"
                  />
                );

              }

              return (

                <button
                  key={key}
                  type="button"
                  disabled={
                    loading
                  }
                  onClick={() => {

                    if (
                      key ===
                      "⌫"
                    ) {

                      deleteNumber();

                      return;

                    }

                    void inputNumber(
                      key
                    );

                  }}
                  className="
                    flex
                    h-16
                    items-center
                    justify-center
                    rounded-2xl
                    border
                    border-[var(--nav-border)]
                    bg-[var(--background)]
                    text-xl
                    font-bold
                    text-[var(--foreground)]
                    transition
                    active:scale-95
                    disabled:opacity-60
                  "
                >

                  {

                    loading &&
                    key !== "⌫"

                      ? ""

                      : key

                  }

                </button>

              );

            }
          )}

        </div>

        {/* LOADING */}

        {loading && (

          <p
            className="
              mt-6
              text-center
              text-sm
              text-[var(--text-muted)]
            "
          >
            {

              t.common_processing ??

              "Processing..."

            }
          </p>

        )}

      </div>

    </main>

  );

}
      
