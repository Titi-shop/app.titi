/* =========================================================
   Pi Auth Utility
   - Client: get accessToken từ Pi Browser
   - Server: verify accessToken với Pi API
   Architecture:
   NETWORK-FIRST + AUTH-CENTRIC
========================================================= */
import {
  logger,
  maskId,
} from "@/lib/logger";
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

  console.log("========== PI AUTH START ==========");

  if (!forceRefresh && cachedToken) {
    console.log("[AUTH] USING CACHE");
    return cachedToken;
  }

  if (authPromise) {
    console.log("[AUTH] USING EXISTING PROMISE");
    return authPromise;
  }

  if (typeof window === "undefined") {
    throw new Error("PI_BROWSER_REQUIRED");
  }

  if (!window.Pi) {
    throw new Error("PI_SDK_NOT_AVAILABLE");
  }

  const scopes = [
  "username",
  "payments",
];

  console.log("[AUTH] SCOPES", scopes);

  authPromise = (async () => {
    try {

      console.log("[AUTH] CALLING Pi.authenticate()");

      const auth = await window.Pi.authenticate(
        scopes,
        async (payment: PiIncompletePayment) => {

          console.log("[AUTH] INCOMPLETE PAYMENT FOUND");
          console.log(payment);

          const paymentId =
            typeof payment.identifier === "string"
              ? payment.identifier
              : "";

          const txid =
            typeof (payment as {
              transaction?: {
                txid?: string;
              };
            }).transaction?.txid === "string"
              ? (payment as {
                  transaction?: {
                    txid?: string;
                  };
                }).transaction!.txid!
              : "";

          logger.info(
            "PI.AUTH.INCOMPLETE_FOUND",
            {
              paymentId: maskId(paymentId),
              hasTxid: !!txid,
            }
          );

          if (paymentId) {
            localStorage.setItem(
              "pi:lastPaymentId",
              paymentId
            );
          }

          if (txid) {
            localStorage.setItem(
              "pi:lastTxid",
              txid
            );
          }

          if (paymentId && txid) {
            try {

              console.log("[AUTH] AUTO COMPLETE START");

              const token =
                await getPiAccessToken(true);

              const res = await fetch(
                "/api/pi/complete-incomplete",
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type":
                      "application/json",
                  },
                  body: JSON.stringify({
                    paymentId,
                    txid,
                  }),
                }
              );

              console.log(
                "[AUTH] AUTO COMPLETE STATUS",
                res.status
              );

            } catch (err) {
              console.error(
                "[AUTH] AUTO COMPLETE ERROR",
                err
              );
            }
          }
        }
      );

      console.log("========== AUTH RESULT ==========");
      console.log(auth);
      console.log("typeof auth =", typeof auth);
      console.log("accessToken =", auth?.accessToken);
      console.log("token length =", auth?.accessToken?.length);
      console.log("user =", auth?.user);
      console.log("===============================");

      if (!auth || !auth.accessToken) {
        throw new Error("PI_AUTH_FAILED");
      }

      cachedToken = auth.accessToken;

console.log(
  "[AUTH] TOKEN PREFIX",
  cachedToken.substring(0, 20)
);

console.log(
  "[AUTH] TOKEN LENGTH",
  cachedToken.length
);

console.log(
  "[AUTH] USER",
  auth.user
);

      logger.info(
        "PI.AUTH.SUCCESS",
        {
          hasUser: !!auth.user,
        }
      );

      logger.debug(
        "PI.AUTH.TOKEN_RECEIVED"
      );

      return cachedToken;

    } finally {

      console.log("[AUTH] FINISH");

      authPromise = null;
    }
  })();

  return authPromise;
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
