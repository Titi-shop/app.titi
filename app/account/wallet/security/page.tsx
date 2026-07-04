// =====================================================
// app/account/wallet/security/page.tsx
// =====================================================

"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  ChevronRight,
} from "lucide-react";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

import {
  apiAuthFetch,
} from "@/lib/api/apiAuthFetch";

/* =====================================================
   TYPES
===================================================== */

type WalletSecurity = {

  pin_enabled: boolean;

  totp_enabled: boolean;

  biometric_enabled: boolean;

  passkey_enabled: boolean;

};

/* =====================================================
   PAGE
===================================================== */

export default function WalletSecurityPage() {

  const router =
    useRouter();

  const { t } =
    useTranslation();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    security,
    setSecurity,
  ] = useState<WalletSecurity | null>(
    null
  );

  const [
    error,
    setError,
  ] = useState("");
    /* ===================================================
     LOAD
  =================================================== */

  async function loadSecurity() {

    try {

      setLoading(
        true
      );

      setError("");

      const response =
        await apiAuthFetch(
          "/api/wallet/security"
        );

      const json =
        await response.json();

      if (!response.ok) {

        setError(
          json.error ??
          "LOAD_FAILED"
        );

        return;

      }

      setSecurity(
        json.security
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

  /* ===================================================
     INIT
  =================================================== */

  useEffect(() => {

    void loadSecurity();

  }, []);
    /* ===================================================
     LOADING
  =================================================== */

  if (loading) {

    return (

      <main
        className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-[var(--background)]
        "
      >

        <div
          className="
            flex
            flex-col
            items-center
            gap-4
          "
        >

          <ShieldCheck
            className="
              h-12
              w-12
              animate-pulse
              text-primary
            "
          />

          <p
            className="
              text-sm
              text-[var(--text-muted)]
            "
          >
            Loading Security...
          </p>

        </div>

      </main>

    );

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

      {/* ==========================================
          HEADER
      ========================================== */}

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
            Wallet Security
          </h1>

          <p
            className="
              mt-1
              text-sm
              text-[var(--text-muted)]
            "
          >
            Protect your wallet with additional security.
          </p>

        </div>

      </div>

      {/* ==========================================
          ERROR
      ========================================== */}

      {error && (

        <div
          className="
            mt-6
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

      {/* ==========================================
          WALLET PIN
      ========================================== */}

     <button
  type="button"
  onClick={() => {

    if (security?.pin_enabled) {

      router.push(
        "/account/wallet/security/change"
      );

      return;

    }

    router.push(
      "/account/wallet/security/setup"
    );

  }}
  className="
    mt-8
    w-full
    rounded-3xl
    border
    border-[var(--nav-border)]
    bg-[var(--card-bg)]
    p-5
    text-left
    transition
    hover:border-primary/30
    active:scale-[0.99]
  "
>

        <div
          className="
            flex
            items-center
            justify-between
          "
        >

          <div
            className="
              flex
              items-center
              gap-4
            "
          >

            <div
              className="
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-2xl
                bg-primary/10
                text-primary
              "
            >

              <Lock
                size={22}
              />

            </div>

            <div>

              <h2
                className="
                  font-semibold
                  text-[var(--foreground)]
                "
              >
                Wallet PIN
              </h2>

              <p
                className="
                  mt-1
                  text-sm
                  text-[var(--text-muted)]
                "
              >

                {security?.pin_enabled
                  ? "PIN protection is enabled."
                  : "Create a PIN to secure withdrawals."}

              </p>

            </div>

          </div>

       <button
  type="button"
  tabIndex={-1}
  className="
    flex
    h-10
    w-10
    items-center
    justify-center
    rounded-xl
    border
    border-[var(--nav-border)]
    pointer-events-none
  "
>
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              border
              border-[var(--nav-border)]
            "
          >

            <ChevronRight
              size={18}
            />

          </button>

        </div>

      </button>
            {/* ==========================================
          GOOGLE AUTHENTICATOR
      ========================================== */}

      <div
        className="
          mt-5
          rounded-3xl
          border
          border-[var(--nav-border)]
          bg-[var(--card-bg)]
          p-5
        "
      >

        <div
          className="
            flex
            items-center
            justify-between
          "
        >

          <div>

            <h2
              className="
                font-semibold
                text-[var(--foreground)]
              "
            >
              Google Authenticator
            </h2>

            <p
              className="
                mt-1
                text-sm
                text-[var(--text-muted)]
              "
            >
              {security?.totp_enabled
                ? "Enabled"
                : "Coming Soon"}
            </p>

          </div>

          <span
            className="
              rounded-full
              bg-yellow-500/10
              px-3
              py-1
              text-xs
              font-medium
              text-yellow-600
            "
          >
            Soon
          </span>

        </div>

      </div>

      {/* ==========================================
          BIOMETRIC
      ========================================== */}

      <div
        className="
          mt-5
          rounded-3xl
          border
          border-[var(--nav-border)]
          bg-[var(--card-bg)]
          p-5
        "
      >

        <div
          className="
            flex
            items-center
            justify-between
          "
        >

          <div>

            <h2
              className="
                font-semibold
                text-[var(--foreground)]
              "
            >
              Face ID / Touch ID
            </h2>

            <p
              className="
                mt-1
                text-sm
                text-[var(--text-muted)]
              "
            >
              {security?.biometric_enabled
                ? "Enabled"
                : "Coming Soon"}
            </p>

          </div>

          <span
            className="
              rounded-full
              bg-yellow-500/10
              px-3
              py-1
              text-xs
              font-medium
              text-yellow-600
            "
          >
            Soon
          </span>

        </div>

      </div>

      {/* ==========================================
          PASSKEY
      ========================================== */}

      <div
        className="
          mt-5
          rounded-3xl
          border
          border-[var(--nav-border)]
          bg-[var(--card-bg)]
          p-5
        "
      >

        <div
          className="
            flex
            items-center
            justify-between
          "
        >

          <div>

            <h2
              className="
                font-semibold
                text-[var(--foreground)]
              "
            >
              Passkey
            </h2>

            <p
              className="
                mt-1
                text-sm
                text-[var(--text-muted)]
              "
            >
              {security?.passkey_enabled
                ? "Enabled"
                : "Coming Soon"}
            </p>

          </div>

          <span
            className="
              rounded-full
              bg-yellow-500/10
              px-3
              py-1
              text-xs
              font-medium
              text-yellow-600
            "
          >
            Soon
          </span>

        </div>

      </div>

    </main>

  );

}
