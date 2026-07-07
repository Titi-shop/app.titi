import {
  piGetPayment,
  piApprovePayment,
} from "@/lib/pi/client";

import {
  getPaymentIntent,
} from "@/lib/db/payments.intent";

import {
  bindPiPaymentToIntent,
} from "@/lib/db/payments.bind";

import {
  getUserById,
} from "@/lib/db/users";
import {
  logger,
  maskId,
} from "@/lib/logger";

/* =========================================================
   HELPERS
========================================================= */

function normalizeString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isSameAmount(
  a: number,
  b: number
): boolean {
  return (
    Math.abs(a - b) <
    0.0000001
  );
}

function isValidIntentState(
  status: unknown
): boolean {
  if (typeof status !== "string") {
    return false;
  }

  return [
    "created",
    "authorized",
    "submitted",
    "pending_settlement",
  ].includes(status);
}

/* =========================================================
   AUTHORIZE SERVICE
========================================================= */

export async function piAuthorizePayment({
  userId,
  authorizationHeader,
  body,
}: Input): Promise<{
  success: true;
}> {
  logger.info(
  "PAYMENT.AUTHORIZE.START",
  {
    userId: maskId(userId),
  }
);
try {
  /* =====================================================
     1. NORMALIZE INPUT
  ===================================================== */

  const paymentIntentId =
    normalizeString(
      body.paymentIntentId ??
        body.payment_intent_id
    );

  const piPaymentId =
    normalizeString(
      body.piPaymentId ??
        body.pi_payment_id
    );

  if (
    !paymentIntentId ||
    !piPaymentId
  ) {
    throw new Error(
      "INVALID_INPUT"
    );
  }

  logger.info(
  "PAYMENT.AUTHORIZE.INPUT_OK",
  {
    paymentIntentId:
      maskId(paymentIntentId),

    piPaymentId:
      maskId(piPaymentId),
  }
);

  /* =====================================================
     2. LOAD PAYMENT INTENT
  ===================================================== */

  const intent =
    await getPaymentIntent(
      paymentIntentId
    );

  if (!intent) {
    throw new Error(
      "INTENT_NOT_FOUND"
    );
  }

  logger.info(
  "PAYMENT.AUTHORIZE.INTENT_OK",
  {
    paymentIntentId:
      maskId(intent.id),

    status:
      intent.status,

    buyerId:
      maskId(intent.buyer_id),

    total:
      intent.total_amount,
  }
);

  /* =====================================================
     3. VERIFY OWNER
  ===================================================== */

  if (
    intent.buyer_id !== userId
  ) {
    throw new Error(
      "INTENT_OWNER_MISMATCH"
    );
  }

  /* =====================================================
     4. VERIFY STATE MACHINE
  ===================================================== */

  if (
    !isValidIntentState(
      intent.status
    )
  ) {
    throw new Error(
      "INVALID_INTENT_STATE"
    );
  }

  /* =====================================================
     5. PREVENT RE-BIND
  ===================================================== */

  if (
    intent.pi_payment_id &&
    intent.pi_payment_id !==
      piPaymentId
  ) {
    throw new Error(
      "PI_PAYMENT_ALREADY_BOUND"
    );
  }

  /* =====================================================
   6. PI VERIFY USER
===================================================== */

logger.debug(
  "PAYMENT.AUTHORIZE.PI_VERIFY_START"
);

const user =
  await getUserById(
    userId
  );

if (!user) {
  throw new Error(
    "USER_NOT_FOUND"
  );
}

if (!user.pi_uid) {
  throw new Error(
    "PI_UID_MISSING"
  );
}

const me = {
  uid: user.pi_uid,
};

logger.info(
  "PAYMENT.AUTHORIZE.PI_USER_READY",
  {
    userId:
      maskId(userId),

    piUid:
      maskId(user.pi_uid),
  }
);

  /* =====================================================
     7. FETCH PI PAYMENT
  ===================================================== */

  const payment =
    await piGetPayment(
      piPaymentId
    );
logger.debug(
  "PAYMENT.AUTHORIZE.PI_IDENTIFIER",
  {
    identifier: payment.identifier,
  }
);
  logger.info(
  "PAYMENT.AUTHORIZE.PI_PAYMENT_OK",
  {
    piPaymentId:
      maskId(piPaymentId),

    amount:
      payment.amount,

    userUid:
      maskId(payment.user_uid),

    developerApproved:
      payment.status?.developer_approved,

    developerCompleted:
      payment.status?.developer_completed,
  }
);
logger.debug(
  "PAYMENT.AUTHORIZE.PI_STATUS",
  {
    developerApproved:
      payment.status?.developer_approved,

    transactionVerified:
      payment.status?.transaction_verified,

    developerCompleted:
      payment.status?.developer_completed,
  }
);
  /* =====================================================
     8. VERIFY PI USER
  ===================================================== */

  if (
    payment.user_uid !==
    me.uid
  ) {
    throw new Error(
      "PI_USER_MISMATCH"
    );
  }

  /* =====================================================
     9. VERIFY CANCELLED
  ===================================================== */

  if (
    payment.status
      ?.cancelled === true ||
    payment.status
      ?.user_cancelled === true
  ) {
    throw new Error(
      "PI_PAYMENT_CANCELLED"
    );
  }
  if (
  payment.status
    ?.developer_completed
) {
  logger.debug(
  "PAYMENT.AUTHORIZE.PI_ALREADY_COMPLETED"
);

  return {
    success: true,
  };
}
  /* =====================================================
     10. VERIFY AMOUNT
  ===================================================== */

  const intentAmount =
    Number(
      intent.total_amount
    );

  const paymentAmount =
    Number(payment.amount);

  if (
    !Number.isFinite(
      intentAmount
    ) ||
    !Number.isFinite(
      paymentAmount
    )
  ) {
    throw new Error(
      "INVALID_PAYMENT_AMOUNT"
    );
  }

  if (
  !isSameAmount(
    intentAmount,
    paymentAmount
  )
) {
  logger.warn(
  "PAYMENT.AUTHORIZE.AMOUNT_MISMATCH",
  {
    intentAmount,
    paymentAmount,
  }
);

  throw new Error(
    "PAYMENT_AMOUNT_MISMATCH"
  );
}

  /* =====================================================
     11. VERIFY RECEIVER WALLET
  ===================================================== */
if (
  !intent.merchant_wallet
) {
  throw new Error(
    "MERCHANT_WALLET_MISSING"
  );
}
  const expectedWallet =
  String(
    intent.merchant_wallet
  )
    .trim()
    .toLowerCase();

const actualWallet =
  String(
    payment.to_address
  )
    .trim()
    .toLowerCase();

logger.info(
  "PAYMENT.AUTHORIZE.WALLET_CHECK",
  {
    expected:
      maskId(expectedWallet),

    actual:
      maskId(actualWallet),
  }
);

if (
  expectedWallet !==
  actualWallet
) {
  throw new Error(
    "MERCHANT_WALLET_MISMATCH"
  );
}

  /* =====================================================
     12. BIND PAYMENT
  ===================================================== */

  logger.debug(
  "PAYMENT.AUTHORIZE.BIND_START"
);
logger.info(
  "PAYMENT.AUTHORIZE.BIND_DATA",
  {
    paymentIntentId:
      maskId(paymentIntentId),

    piPaymentId:
      maskId(piPaymentId),

    piUid:
      maskId(me.uid),

    verifiedAmount:
      paymentAmount,
  }
);
  try {
  await bindPiPaymentToIntent({
    userId,
    paymentIntentId,
    piPaymentId,
    piUid: me.uid,
    verifiedAmount: paymentAmount,
    piPayload: payment,
  });

  logger.info(
  "PAYMENT.AUTHORIZE.BIND_DONE"
);
} catch (error) {
  logger.error(
  "PAYMENT.AUTHORIZE.BIND_ERROR",
  {
    message:
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR",
  }
);

  throw error;
}

  /* =====================================================
     13. APPROVE PAYMENT
  ===================================================== */

  if (
  !payment.status?.developer_approved
) {
  logger.info(
    "PAYMENT.AUTHORIZE.PI_APPROVE_START"
  );

  await piApprovePayment(
    piPaymentId
  );

  logger.info(
    "PAYMENT.AUTHORIZE.PI_APPROVE_DONE"
  );
} else {
  logger.debug(
    "PAYMENT.AUTHORIZE.PI_ALREADY_APPROVED"
  );
}
}
  } else {
    logger.debug(
  "PAYMENT.AUTHORIZE.PI_ALREADY_APPROVED"
);
  }

  /* =====================================================
     14. SUCCESS
  ===================================================== */

  logger.info(
  "PAYMENT.AUTHORIZE.SUCCESS",
  {
    paymentIntentId:
      maskId(paymentIntentId),

    piPaymentId:
      maskId(piPaymentId),
  }
);

  return {
    success: true,
  };
  } catch (error) {
   logger.error(
     "PAYMENT.AUTHORIZE.ERROR",
     {
       message:
         error instanceof Error
           ? error.message
           : "UNKNOWN_ERROR",
     }
   );
   throw error;
}
}
