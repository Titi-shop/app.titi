// =====================================================
// lib/pi/pi.a2u.ts
// =====================================================

import * as StellarSdk
  from "@stellar/stellar-sdk";
import {
  logger,
  maskId,
  maskWallet,
} from "@/lib/logger";
type PiConfig = {
  api: string;
  key: string;
  seed: string;
  horizon: string;
  networkPassphrase: string;
};

function getPiConfig(): PiConfig {
  const api = process.env.PI_API_URL;
  const key = process.env.PI_API_KEY;
  const seed = process.env.PI_WALLET_PRIVATE_SEED;
  const horizon = process.env.PI_HORIZON_URL;
  const networkPassphrase = process.env.PI_NETWORK_PASSPHRASE;

  if (!api) {
    throw new Error("MISSING_PI_API_URL");
  }

  if (!key) {
    throw new Error("MISSING_PI_API_KEY");
  }

  if (!seed) {
    throw new Error("MISSING_PI_WALLET_PRIVATE_SEED");
  }

  if (!horizon) {
    throw new Error("MISSING_PI_HORIZON_URL");
  }

  if (!networkPassphrase) {
    throw new Error("MISSING_PI_NETWORK_PASSPHRASE");
  }

  return {
    api,
    key,
    seed,
    horizon,
    networkPassphrase,
  };
}

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
    network?: string;
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
export type A2USubmitResult = {
  txid: string;

  ledger: number | null;
  memo: string | null;
  fee: string | null;
  fromAddress: string | null;
  toAddress: string |null;
  network: string | null;
};
/* =====================================================
   INTERNAL REQUEST
===================================================== */

async function piRequest<T>(
  path: string,
  init: RequestInit
): Promise<T> {
  const safePath =
  path.replace(
    /\/payments\/([^/]+)/,
    (_, id) =>
      `/payments/${maskId(id)}`
  );

logger.debug(
  "PI_A2U.REQUEST",
  {
    path: safePath,
    method: init.method,
  }
);

  const { api } = getPiConfig();

const res = await fetch(
  `${api}${path}`,
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

  logger.info(
  "PI_A2U.STATUS",
  {
    status: res.status,
  }
);

  if (!res.ok) {
    logger.error(
  "PI_A2U.HTTP_FAIL",
  {
    path: safePath,
    status: res.status,
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
  logger.info("PI_A2U.CREATE_START");
  const data =
    await piRequest<A2UPayment>(
      "/v2/payments",
      {
        method: "POST",

        headers: {
          Authorization: `Key ${key}`,
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

  logger.info("PI_A2U.CREATE_SUCCESS");

  return data.identifier;
}

/* =====================================================
   GET PAYMENT
===================================================== */

export async function getA2UPayment(
  paymentId: string
): Promise<A2UPayment> {

  logger.debug("PI_A2U.GET_START");

  const { key } = getPiConfig();

  const data =
    await piRequest<A2UPayment>(
      `/v2/payments/${paymentId}`,
      {
        method: "GET",

        headers: {
          Authorization: `Key ${key}`,
        },
      }
    );

  logger.debug("PI_A2U.GET_SUCCESS");

  return data;
}
/* =====================================================
   COMPLETE PAYMENT
===================================================== */

export async function completeA2UPayment(
  paymentId: string,
  txid: string
): Promise<void> {
  logger.info("PI_A2U.COMPLETE_START");

  const { key } = getPiConfig();

  await piRequest(
    `/v2/payments/${paymentId}/complete`,
    {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        txid,
      }),
    }
  );

  logger.info("PI_A2U.COMPLETE_SUCCESS");
}
/* =====================================================
   SUBMIT PAYMENT
===================================================== */

export async function submitA2UPayment(
  paymentId: string
): Promise<A2USubmitResult> {

  logger.info("PI_A2U.SUBMIT_START");

  const payment =
    await getA2UPayment(
      paymentId
    );

  logger.debug("PI_A2U.SUBMIT_READY");

  if (
  payment.transaction?.txid
) {
  logger.info(
    "PI_A2U.ALREADY_SUBMITTED"
);

  return {
  txid:
    payment.transaction.txid,
  ledger: null,
  memo:
    payment.memo ?? null,
  fee: null,
  fromAddress:
    payment.from_address ?? null,
  toAddress:
    payment.to_address ?? null,
  network:
    payment.network ?? null,
};
}

  const {
  seed,
  horizon,
  networkPassphrase,
} = getPiConfig();

const keypair =
  StellarSdk.Keypair.fromSecret(seed);

const server =
  new StellarSdk.Horizon.Server(horizon);

const account =
  await server.loadAccount(
    keypair.publicKey()
  );
  logger.debug(
    "PI_A2U.ACCOUNT_READY"
);

  const fee =
    await server.fetchBaseFee();

  logger.debug(
    "PI_A2U.FEE_READY"
);

  const tx =
    new StellarSdk.TransactionBuilder(
      account,
 {
  fee: fee.toString(),
  networkPassphrase:
    networkPassphrase,
}
    )
      .addOperation(
        StellarSdk.Operation.payment(
          {
            destination:
              payment.to_address!,
            asset:
              StellarSdk.Asset.native(),
            amount:
              String(
                payment.amount
              ),
          }
        )
      )
      .addMemo(
        StellarSdk.Memo.text(
          payment.identifier
        )
      )
      .setTimeout(
        180
      )
      .build();

  tx.sign(
    keypair
  );

  logger.debug(
  "PI_A2U.TX_SIGNED"
);

  const submitResult =
    await server.submitTransaction(
      tx
    );

  logger.info(
    "PI_A2U.TX_SUBMITTED"
);

return {
  txid: String(submitResult.id),
  ledger:
    submitResult.ledger ?? null,
  memo:
    payment.identifier,
  fee:
    submitResult.fee_charged ?? null,
  fromAddress:
    payment.from_address ?? null,
  toAddress:
    payment.to_address ?? null,
  network:
    payment.network ?? null,
};
}
/* =====================================================
   CANCEL PAYMENT
===================================================== */

export async function cancelA2UPayment(
  paymentId: string
): Promise<void> {
  logger.info("PI_A2U.CANCEL_START");

  const { key } = getPiConfig();

  await piRequest(
    `/v2/payments/${paymentId}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
      },
    }
  );

  logger.info("PI_A2U.CANCEL_SUCCESS");
}
/* =====================================================
   DEBUG PAYMENT
===================================================== */

export async function debugA2UPayment(
  paymentId: string
): Promise<A2UPayment> {

  logger.debug(
  "PI_A2U.DEBUG_PAYMENT_START",
  {
    paymentId:
      maskId(paymentId),
  }
);

  const payment =
    await getA2UPayment(
      paymentId
    );

  logger.debug(
  "PI_A2U.DEBUG_PAYMENT",
  {
    paymentId:
      maskId(
        payment.identifier
      ),

    developerApproved:
      payment.status
        ?.developer_approved,

    developerCompleted:
      payment.status
        ?.developer_completed,
  }
);

  return payment;
}
