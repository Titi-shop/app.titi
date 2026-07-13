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
let cachedToken: string | null = null;
let authPromise: Promise<string> | null = null;

/* =========================================================
   PI TYPES
========================================================= */


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

  if (!forceRefresh && cachedToken) {
    return cachedToken;
  }

  if (authPromise) {
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

  authPromise = (async () => {
    try {

      const auth = await window.Pi.authenticate(
  scopes,
  async (payment: PiIncompletePayment) => {
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
      localStorage.setItem("pi:lastPaymentId", paymentId);
      logger.debug(
     "PI.AUTH.PAYMENT_ID_SAVED"
  );
    }

    if (txid) {
      localStorage.setItem("pi:lastTxid", txid);
      logger.debug(
  "PI.AUTH.TXID_SAVED"
);
    }

    // 🔥 AUTO FIX KẸT ĐƠN
    if (paymentId && txid) {
      try {
        logger.info(
  "PI.AUTH.AUTO_COMPLETE_START",
  {
    paymentId: maskId(paymentId),
  }
);
        const token = await getPiAccessToken(true);

        const res = await fetch("/api/pi/complete-incomplete", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentId,
            txid,
          }),
        });

        logger.info(
  "PI.AUTH.AUTO_COMPLETE_RESULT",
  {
    paymentId: maskId(paymentId),
    status: res.status,
    ok: res.ok,
  }
);

      } catch (err) {
        logger.error(
  "PI.AUTH.AUTO_COMPLETE_ERROR",
  {
    paymentId: maskId(paymentId),
    message:
      err instanceof Error
        ? err.message
        : "UNKNOWN_ERROR",
  }
);

if (
  process.env.NODE_ENV !==
  "production"
) {
  console.error(err);
}
      }
    }
  }
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
      if (!auth || !auth.accessToken) {
        throw new Error("PI_AUTH_FAILED");
      }

      cachedToken = auth.accessToken;

      return cachedToken;

    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}

/* =========================================================
   CLEAR TOKEN (LOGOUT)
========================================================= */

export function clearPiToken(): void {
  cachedToken = null;
  authPromise = null;
}
