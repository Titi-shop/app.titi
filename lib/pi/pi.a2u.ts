// =====================================================
// lib/pi/pi.a2u.ts
// =====================================================

const PI_API =
  process.env.PI_API_URL;

const PI_KEY =
  process.env.PI_API_KEY;

function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[PI_A2U][${step}]`,
    data ?? ""
  );
}

if (!PI_API) {
  throw new Error(
    "MISSING_PI_API_URL"
  );
}

if (!PI_KEY) {
  throw new Error(
    "MISSING_PI_API_KEY"
  );
}
const PI_SEED =
  process.env
    .PI_WALLET_PRIVATE_SEED;

vlog(
  "ENV_CHECK",
  {
    hasApiUrl:
      !!PI_API,
    hasApiKey:
      !!PI_KEY,
    hasWalletSeed:
      !!PI_SEED,
    apiUrl:
      PI_API,
  }
);
/* =====================================================
   TYPES
===================================================== */

export type CreateA2UPaymentInput =
  {
    uid: string;
    amount: number;
    memo: string;
    metadata: Record<
      string,
      unknown
    >;
  };

export type A2UPayment =
  {
    identifier: string;
    user_uid: string;
    amount: number;
    memo: string;

    metadata?: Record<
      string,
      unknown
    >;

    from_address?: string;
    to_address?: string;

    status?: {
      developer_approved?: boolean;
      transaction_verified?: boolean;
      developer_completed?: boolean;
      cancelled?: boolean;
      user_cancelled?: boolean;
    };

    transaction?: {
      txid?: string;
      verified?: boolean;
      _link?: string;
    };
  };

/* =====================================================
   INTERNAL REQUEST
===================================================== */

async function piRequest<T>(
  path: string,
  init: RequestInit
): Promise<T> {
  vlog(
    "REQUEST_START",
    {
      path,
      method:
        init.method,
    }
  );

  const res = await fetch(
    `${PI_API}${path}`,
    {
      ...init,
      cache:
        "no-store",
    }
  );

  const text =
    await res.text();

  let json:
    | unknown
    | null =
    null;

  try {
    json = text
      ? JSON.parse(
          text
        )
      : null;
  } catch {
    throw new Error(
      "PI_INVALID_JSON"
    );
  }

  vlog(
    "REQUEST_RESPONSE",
    {
      status:
        res.status,
    }
  );

  if (!res.ok) {
    console.error(
      "[PI_A2U][HTTP_FAIL]",
      {
        path,
        status:
          res.status,
        body: json,
      }
    );

    throw new Error(
      `PI_HTTP_${res.status}`
    );
  }

  return json as T;
}

/* =====================================================
   CREATE PAYMENT
===================================================== */

export async function createA2UPayment(
  input: CreateA2UPaymentInput
): Promise<string> {
  vlog(
    "CREATE_START",
    input
  );

  const data =
    await piRequest<A2UPayment>(
      "/v2/payments",
      {
        method: "POST",

        headers: {
          Authorization:
            `Key ${PI_KEY}`,
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            {
              payment:
                {
                  uid:
                    input.uid,
                  amount:
                    input.amount,
                  memo:
                    input.memo,
                  metadata:
                    input.metadata,
                },
            }
          ),
      }
    );

  if (
    !data?.identifier
  ) {
    throw new Error(
      "A2U_CREATE_FAILED"
    );
  }

  vlog(
    "CREATE_SUCCESS",
    {
      paymentId:
        data.identifier,
    }
  );

  return data.identifier;
}

/* =====================================================
   GET PAYMENT
===================================================== */

export async function getA2UPayment(
  paymentId: string
): Promise<A2UPayment> {
  vlog(
    "GET_START",
    paymentId
  );

  const data =
    await piRequest<A2UPayment>(
      `/v2/payments/${paymentId}`,
      {
        method: "GET",

        headers: {
          Authorization:
            `Key ${PI_KEY}`,
        },
      }
    );

  vlog(
    "GET_SUCCESS",
    {
      paymentId:
        data.identifier,
    }
  );

  return data;
}

/* =====================================================
   COMPLETE PAYMENT
===================================================== */

export async function completeA2UPayment(
  paymentId: string,
  txid: string
): Promise<void> {
  vlog(
    "COMPLETE_START",
    {
      paymentId,
      txid,
    }
  );

  await piRequest(
    `/v2/payments/${paymentId}/complete`,
    {
      method: "POST",

      headers: {
        Authorization:
          `Key ${PI_KEY}`,
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(
          {
            txid,
          }
        ),
    }
  );

  vlog(
    "COMPLETE_SUCCESS",
    {
      paymentId,
    }
  );
}
/* =====================================================
   DEBUG PAYMENT
===================================================== */

export async function debugA2UPayment(
  paymentId: string
): Promise<A2UPayment> {

  vlog(
    "DEBUG_PAYMENT_START",
    paymentId
  );

  const payment =
    await getA2UPayment(
      paymentId
    );

  vlog(
    "DEBUG_PAYMENT_RESULT",
    JSON.stringify(
      payment,
      null,
      2
    )
  );

  return payment;
}
