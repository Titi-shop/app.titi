const PI_API_URL = process.env.PI_API_URL ?? "https://api.minepi.com/v2";

let cachedToken: string | null = null;
let authPromise: Promise<string> | null = null;

/* =========================================================
   PI TYPES
========================================================= */

export type PiUser = {
  pi_uid: string;
  username: string;
};
type PiIncompletePayment = {
  identifier?: string;
  amount?: number;
  memo?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

type PiAuthResult = {
  accessToken: string;
  user?: {
    uid: string;
    username: string;
  };
};

type PiBrowser = {
  init(options: {
    version: string;
    sandbox: boolean;
  }): void | Promise<void>;
  authenticate(
    scopes: string[],
    onIncompletePaymentFound: (payment: unknown) => void
  ): Promise<PiAuthResult>;
};

declare global {
  interface Window {
    Pi?: PiBrowser;
  }
}

/* =========================================================
   CLIENT: GET PI ACCESS TOKEN
========================================================= */

      export async function getPiAccessToken(
  forceRefresh = false
): Promise<string> {
  try {
    console.log("🚀 [PiAuth] getPiAccessToken called");

    // 1. cache token
    if (!forceRefresh && cachedToken) {
      console.log("♻️ [PiAuth] using cached token");
      return cachedToken;
    }

    // 2. prevent duplicate calls
    if (authPromise) {
      console.log("⏳ [PiAuth] waiting existing authPromise");
      return authPromise;
    }

    // 3. SSR check
    if (typeof window === "undefined") {
      throw new Error("PI_BROWSER_REQUIRED");
    }

    // 4. SDK check
    if (!window.Pi) {
      throw new Error("PI_SDK_NOT_AVAILABLE");
    }

    const scopes = ["username", "payments"];

    authPromise = (async () => {
      try {
        console.log("🟡 [PiAuth] calling Pi.authenticate...");

        const auth = await window.Pi.authenticate(
          scopes,
          async (payment: PiIncompletePayment) => {
            console.log("🔁 INCOMPLETE PAYMENT:", payment);

            const paymentId =
              typeof payment.identifier === "string"
                ? payment.identifier
                : "";

            const txid =
              typeof (payment as any)?.transaction?.txid === "string"
                ? (payment as any).transaction.txid
                : "";

            if (paymentId) {
              localStorage.setItem("pi:lastPaymentId", paymentId);
            }

            if (txid) {
              localStorage.setItem("pi:lastTxid", txid);
            }

            // auto fix pending payment
            if (paymentId && txid) {
              try {
                console.log("🟡 AUTO COMPLETE START");

                const token = await getPiAccessToken(true);

                await fetch("/api/pi/complete-incomplete", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ paymentId, txid }),
                });

                console.log("🟢 AUTO COMPLETE DONE");
              } catch (err) {
                console.error("❌ AUTO COMPLETE FAIL", err);
              }
            }
          }
        );

        console.log("📦 [PiAuth] auth response:", auth);

        if (!auth?.accessToken) {
          throw new Error("PI_AUTH_FAILED_NO_TOKEN");
        }

        cachedToken = auth.accessToken;

        console.log("🟢 [PiAuth] LOGIN SUCCESS");

        return cachedToken;
      } catch (err) {
        console.error("❌ [PiAuth] authenticate error:", err);
        throw err;
      } finally {
        authPromise = null;
      }
    })();

    return authPromise;
  } catch (err) {
    console.error("❌ [PiAuth] fatal error:", err);
    authPromise = null;
    throw err;
  }
}

/* =========================================================
   SERVER: VERIFY PI TOKEN
========================================================= */

export async function verifyPiToken(
  token: string
): Promise<PiUser> {

  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const res = await fetch(`${PI_API_URL}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("PI_TOKEN_INVALID");
  }

  const data = (await res.json()) as {
    uid?: string;
    username?: string;
  };

  if (!data.uid || !data.username) {
    throw new Error("PI_USER_INVALID");
  }

  return {
    pi_uid: data.uid,
    username: data.username,
  };
}

/* =========================================================
   SERVER: GET PI USER FROM REQUEST TOKEN
========================================================= */

export async function getPiUserFromToken(
  req: Request
): Promise<PiUser | null> {

  const auth = req.headers.get("authorization");

  if (!auth || !auth.startsWith("Bearer ")) {
    return null;
  }

  const token = auth.replace("Bearer ", "").trim();

  try {
    return await verifyPiToken(token);
  } catch {
    return null;
  }
}
/* =========================================================
   CLEAR TOKEN (LOGOUT)
========================================================= */

export function clearPiToken(): void {
  cachedToken = null;
}
