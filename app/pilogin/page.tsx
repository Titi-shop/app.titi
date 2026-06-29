// =====================================================
// app/pilogin/page.tsx
// =====================================================

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

export default function PiLoginPage() {

  const router = useRouter();

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

  /* ===================================================
     LOADING
  =================================================== */

  if (
    loading
  ) {

    return (
      <main
        className="
          flex
          min-h-screen
          items-center
          justify-center
        "
      >
        <div className="text-sm opacity-70">
          Loading...
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
    background: "var(--background)",
    paddingTop: "env(safe-area-inset-top)",
    paddingBottom: "env(safe-area-inset-bottom)",
  }}
>
   <div
  className="
    w-full
    max-w-md
    rounded-3xl
    border
    p-8
    shadow-sm
  "
  style={{
    background: "var(--card-bg)",
    borderColor: "var(--border-color)",
  }}
>

        {/* LOGO */}

        <div className="flex justify-center">

          <Image
            src="/banners/3D035BE4-0822-403D-9631-6C4CF674A519.png"
            alt="TITI"
            width={72}
            height={72}
            className="rounded-2xl"
          />

        </div>

        {/* TITLE */}

        <h1 className="mt-6 text-center text-3xl font-bold">

          TITI

        </h1>

        <p
          className="
            mt-2
            text-center
            text-sm
            opacity-70
          "
        >
          Sign in using your
          Pi Network account.
        </p>

        {/* TERMS */}

        <div className="mt-8 flex items-start gap-3">

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
              accent-orange-600
            "
          />

          <label
            className="
              text-sm
              leading-6
              opacity-80
            "
          >

            {t.i_agree}{" "}

            <a
              href="/terms-of-service"
              target="_blank"
              className="
                font-medium
                text-orange-600
                underline
              "
            >
              {t.terms_of_use}
            </a>

            {" "}

            {t.and}

            {" "}

            <a
              href="/privacy-policy"
              target="_blank"
              className="
                font-medium
                text-orange-600
                underline
              "
            >
              {t.privacy_policy}
            </a>

          </label>

        </div>

        {/* LOGIN */}

        <button
          onClick={pilogin}
          disabled={
            !piReady ||
            !agreed
          }
          className={`
            mt-8
            h-14
            w-full
            rounded-2xl
            font-semibold
            text-white
            transition

            ${
              piReady &&
              agreed
                ? "bg-orange-600 hover:bg-orange-700 active:scale-95"
                : "cursor-not-allowed bg-gray-400"
            }
          `}
        >

          Continue with Pi Network

        </button>

        {/* FOOTER */}

        <p
          className="
            mt-6
            text-center
            text-xs
            opacity-60
          "
        >
          Powered by Pi Network
        </p>

      </div>

    </main>

  );

}
