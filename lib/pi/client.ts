
/* =========================================================
   PI PLATFORM CLIENT
   Single source of truth for all Pi API communication
========================================================= */

import {
  logger,
  maskId,
} from "@/lib/logger";

const PI_API = process.env.PI_API_URL;
const PI_KEY = process.env.PI_API_KEY;

if (!PI_API) {
  throw new Error("MISSING_PI_API_URL");
}

if (!PI_KEY) {
  throw new Error("MISSING_PI_API_KEY");
}

logger.info(
  "PI_CLIENT.CONFIG",
  {
    hasApiKey: true,
  }
);

/* =========================================================
   TYPES
========================================================= */

export type PiUserMe = {
  uid: string;
  username?: string;
};

export type PiPaymentStatus = {
  developer_approved?: boolean;
  transaction_verified?: boolean;
  developer_completed?: boolean;
  cancelled?: boolean;
  user_cancelled?: boolean;
};

export type PiPaymentTransaction = {
  txid?: string;
  verified?: boolean;
  _link?: string;
};

export type PiPaymentData = {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  from_address: string;
  to_address: string;
  status?: PiPaymentStatus;
  metadata?: Record<string, unknown>;
  transaction?: PiPaymentTransaction;
};

/* =========================================================
   INTERNAL REQUEST
========================================================= */

async function piRequest<T>(
  path: string,
  init: RequestInit
): Promise<T> {
   const safePath = path.replace(
  /\/payments\/([^/]+)/,
  (_, id) => `/payments/${maskId(id)}`
);

logger.debug(
  "PI_CLIENT.REQUEST",
  {
    path: safePath,
    method: init.method,
  }
);

const headers =
  init.headers as Record<
    string,
    unknown
  >;

logger.debug(
  "PI_CLIENT.REQUEST_HEADERS",
  {
    ...headers,

    Authorization:
      headers.Authorization
        ? "REDACTED"
        : undefined,
  }
);
  const res = await fetch(`${PI_API}${path}`, {
    ...init,
    cache: "no-store",
  });

  const text = await res.text();
logger.debug(
  "PI_CLIENT.RESPONSE_RAW",
  {
    length: text.length,
  }
);

logger.info(
  "PI_CLIENT.STATUS",
  {
    status: res.status,
  }
);
  let json: unknown = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("PI_INVALID_JSON");
  }

  if (!res.ok) {
    logger.error(
  "PI_CLIENT.HTTP_FAIL",
  {
    path: safePath,
    status: res.status,
  }
);

    throw new Error(`PI_HTTP_${res.status}`);
  }

  return json as T;
}

/* =========================================================
   VERIFY PI USER TOKEN
========================================================= */

export async function piGetMe(
  bearerToken: string
): Promise<PiUserMe> {
  const token =
    bearerToken
      .replace("Bearer ", "")
      .trim();

  if (!token) {
    throw new Error(
      "MISSING_PI_BEARER"
    );
  }

  const data =
  await piRequest<PiUserMe>(
    "/v2/me",
    {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    }
  );

logger.info(
  "PI_CLIENT.ME",
  {
    uid: maskId(data.uid),
    username: data.username,
  }
);

  if (!data?.uid) {
    throw new Error(
      "INVALID_PI_USER"
    );
  }

  return data;
}

/* =========================================================
   FETCH PAYMENT
========================================================= */

export async function piGetPayment(
  piPaymentId: string
): Promise<PiPaymentData> {
  const id = String(piPaymentId || "").trim();

  if (!id) {
    throw new Error("MISSING_PI_PAYMENT_ID");
  }
logger.debug(
  "PI_CLIENT.GET_PAYMENT",
  {
    paymentId: maskId(id),
  }
);

const data =
  await piRequest<PiPaymentData>(
    `/v2/payments/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Key ${PI_KEY}`,
    },
  });
logger.info(
  "PI_CLIENT.PAYMENT",
  {
    paymentId:
      maskId(data.identifier),

    amount:
      data.amount,

    developerApproved:
      data.status?.developer_approved,

    developerCompleted:
      data.status?.developer_completed,

    transactionVerified:
      data.status?.transaction_verified,
  }
);
  if (!data?.identifier) {
    throw new Error("PI_PAYMENT_FETCH_FAILED");
  }

  logger.info(
  "PI_CLIENT.PAYMENT_OK",
  {
    paymentId:
      maskId(data.identifier),

    amount:
      data.amount,
  }
);

  return data;
}

/* =========================================================
   APPROVE PAYMENT
========================================================= */

export async function piApprovePayment(
  piPaymentId: string
): Promise<{ success: true }> {
  const id = String(piPaymentId || "").trim();

  if (!id) {
    throw new Error("MISSING_PI_PAYMENT_ID");
  }

  await piRequest<unknown>(
  `/v2/payments/${id}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Key ${PI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  logger.info(
  "PI_CLIENT.APPROVE_OK",
  {
    paymentId:
      maskId(id),
  }
);

  return { success: true };
}

/* =========================================================
   COMPLETE PAYMENT
========================================================= */

export async function piCompletePayment(
  piPaymentId: string,
  txid: string
): Promise<{ success: true }> {
  const id = String(piPaymentId || "").trim();
  const tx = String(txid || "").trim();

  if (!id) {
    throw new Error("MISSING_PI_PAYMENT_ID");
  }

  if (!tx) {
    throw new Error("MISSING_TXID");
  }

  const res = await fetch(
  `${PI_API}/v2/payments/${id}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Key ${PI_KEY}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ txid: tx }),
  });

  const text = await res.text();

  if (!res.ok) {
    if (text.includes("already_completed")) {
      logger.info(
  "PI_CLIENT.COMPLETE_ALREADY_DONE",
  {
    paymentId:
      maskId(id),
  }
);
      return { success: true };
    }

    logger.error(
  "PI_CLIENT.COMPLETE_FAIL",
  {
    paymentId:
      maskId(id),

    status:
      res.status,
  }
);

    throw new Error("PI_COMPLETE_FAILED");
  }

  logger.info(
  "PI_CLIENT.COMPLETE_OK",
  {
    paymentId:
      maskId(id),
  }
);

  return { success: true };
}
