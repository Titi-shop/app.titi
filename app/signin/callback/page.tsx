"use client";

import { useEffect, useState } from "react";

export default function PiSigninCallbackPage() {
  const [status, setStatus] = useState(
    "Signing you in..."
  );

  useEffect(() => {
    async function handleCallback() {
      try {
        const hash =
          window.location.hash;

        if (!hash) {
          setStatus(
            "No callback data."
          );
          return;
        }

        const params =
          new URLSearchParams(
            hash.substring(1)
          );

        const accessToken =
          params.get(
            "access_token"
          ) ?? "";

        const oauthState =
          params.get(
            "state"
          ) ?? "";

        const error =
          params.get(
            "error"
          ) ?? "";

        /* =====================
           OAUTH ERROR
        ===================== */

        if (error) {
          setStatus(
            `Login failed: ${error}`
          );

          return;
        }

        /* =====================
           VERIFY STATE
        ===================== */

        const expectedState =
          sessionStorage.getItem(
            "pi_oauth_state"
          ) ?? "";

        if (
          oauthState !==
          expectedState
        ) {
          setStatus(
            "Invalid state."
          );

          return;
        }

        sessionStorage.removeItem(
          "pi_oauth_state"
        );

        /* =====================
           VERIFY TOKEN
        ===================== */

        if (!accessToken) {
          setStatus(
            "Access token not found."
          );

          return;
        }

        const res =
          await fetch(
            "/api/pi/verify",
            {
              method: "POST",
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },
            }
          );

        if (!res.ok) {
          setStatus(
            "Verification failed."
          );

          return;
        }

        /* =====================
           SAVE TOKEN
        ===================== */

        localStorage.setItem(
          "pi_access_token",
          accessToken
        );

        /* =====================
           REMOVE HASH
        ===================== */

        history.replaceState(
          null,
          "",
          window.location.pathname
        );

        /* =====================
           REDIRECT
        ===================== */

        window.location.replace(
          "/account"
        );
      } catch {
        setStatus(
          "Unexpected error."
        );
      }
    }

    void handleCallback();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">

        <h1 className="text-3xl font-bold">
          Pi Sign-In
        </h1>

        <p className="mt-4 text-gray-500">
          {status}
        </p>

      </div>
    </main>
  );
}
