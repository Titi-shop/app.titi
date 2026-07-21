// =====================================================
// app/pilogin/page.tsx
// =====================================================

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

export default function PiLoginPage() {

  const router =
    useRouter();

  const { t } =
    useTranslation();

  const {
    user,
    loading,
    piReady,
    pilogin,
  } = useAuth();

  const [
    agreed,
    setAgreed,
  ] = useState(false);

  /* ===================================================
     ALREADY LOGIN
  =================================================== */

  useEffect(() => {

    if (
      !loading &&
      user
    ) {

      router.replace(
        "/account"
      );

    }

  }, [
    loading,
    user,
    router,
  ]);
const login = async () => {

  if (!agreed) {
    return;
  }

  // Pi Browser
  if (typeof window !== "undefined" && window.Pi) {
    await pilogin();
    return;
  }

  // OAuth (Chrome/Safari/Desktop)
  const state =
    crypto.randomUUID();

  sessionStorage.setItem(
    "pi_oauth_state",
    state
  );

  const url = new URL(
    "https://accounts.pinet.com/oauth/authorize"
  );

  url.searchParams.set(
    "response_type",
    "token"
  );

  url.searchParams.set(
    "client_id",
    process.env
      .NEXT_PUBLIC_PI_CLIENT_ID ??
      ""
  );

  url.searchParams.set(
    "redirect_uri",
    "https://app.titi.onl/signin/callback"
  );

  url.searchParams.set(
    "scope",
    "username"
  );

  url.searchParams.set(
    "state",
    state
  );

  window.location.href =
    url.toString();
};
  /* ===================================================
     LOADING
  =================================================== */

  if (loading) {

    return (

      <main
        className="
          fixed
          inset-0
          flex
          items-center
          justify-center
        "
        style={{
          background:
            "var(--background)",
        }}
      >

        <div
          className="
            card
            w-full
            max-w-sm
            animate-fade-in
            text-center
          "
        >

          <div
            className="
              skeleton
              mx-auto
              mb-5
              h-16
              w-16
              rounded-2xl
            "
          />

          <div
            className="
              skeleton
              mx-auto
              mb-3
              h-6
              w-40
              rounded-lg
            "
          />

          <div
            className="
              skeleton
              mx-auto
              h-4
              w-56
              rounded-lg
            "
          />

        </div>

      </main>

    );

  }

  /* ===================================================
     PAGE
  =================================================== */

  return (

    <main
      className="
        fixed
        inset-0
        flex
        items-center
        justify-center
        overflow-hidden
        px-5
      "
      style={{
        background:
          "var(--background)",
        paddingTop:
          "env(safe-area-inset-top)",
        paddingBottom:
          "env(safe-area-inset-bottom)",
      }}
    >

      <div
        className="
          card
          animate-scale-in
          w-full
          max-w-md
          px-8
          py-8
        "
      >

        {/* ======================
            LOGO
        ====================== */}

        <div className="flex justify-center">

          <Image
            src="/banners/3D035BE4-0822-403D-9631-6C4CF674A519.png"
            alt="TITI"
            width={72}
            height={72}
            priority
            className="radius-lg"
          />

        </div>

        {/* ======================
            TITLE
        ====================== */}

        <h1
          className="
            mt-6
            text-center
            text-3xl
            font-bold
          "
          style={{
            color:
              "var(--text-primary)",
          }}
        >
          {t.login_title ??
            "TITI Marketplace"}
        </h1>

        <p
          className="
            mt-3
            text-center
            text-sm
            text-muted
          "
        >
          {t.login_subtitle ??
            "Sign in with your Pi Network account"}
        </p>

        {/* ======================
            TERMS
        ====================== */}

        <div
          className="
            mt-8
            flex
            items-start
            gap-3
          "
        >

          <input
            type="checkbox"
            checked={agreed}
            onChange={() =>
              setAgreed(
                !agreed
              )
            }
            className="
              mt-1
              h-4
              w-4
              accent-orange-500
            "
          />

          <label
            className="
              text-sm
              leading-6
              text-muted
            "
          >

            {t.i_agree}{" "}

    <Link
  href="/terms-of-service"
  style={{ color: "var(--color-link)" }}
  className="font-semibold underline underline-offset-4"
>
  {t.terms_of_use}
</Link>
            {" "}

            {t.and}

            {" "}

   <Link
  href="/privacy-policy"
  style={{ color: "var(--color-link)" }}
  className="font-semibold underline underline-offset-4"
>
  {t.privacy_policy}
</Link>

          </label>

        </div>

          {/* ======================
            LOGIN
        ====================== */}
<button
  onClick={login}
  disabled={!agreed}
  className={
    piReady && agreed
      ? "btn-primary mt-8 h-14 w-full"
      : "btn-primary mt-8 h-14 w-full opacity-50 cursor-not-allowed"
  }
>
  {
  typeof window !== "undefined" &&
  window.Pi
    ? "Continue with Pi Network"
    : "Sign in with Pi"
}
</button>

        {/* ======================
            NOT READY
        ====================== */}

        {!piReady && (

          <p
            className="
              mt-4
              text-center
              text-xs
              text-warning
            "
          >
            {t.login_not_ready ??
              "Pi Network is not ready."}
          </p>

        )}

        {/* ======================
            FOOTER
        ====================== */}

        <div
          className="
            mt-8
            border-t
            border-default
            pt-6
            text-center
          "
        >

          <p
            className="
              text-xs
              text-muted
            "
          >
            {t.powered_by_pi ??
              "Powered by Pi Network"}
          </p>

          <p
            className="
              mt-2
              text-xs
              text-muted
            "
          >
            © 2026 TITI Marketplace
          </p>

        </div>

      </div>

    </main>

  );

}
        
