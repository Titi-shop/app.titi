// =====================================================
// lib/db/settlement/settlement.release.ts
// =====================================================
import { getRpcVerificationLog } from "@/lib/db/payments.rpc";
import type {
  EscrowReleaseRow,
  ReleaseEscrowFlowInput,
} from "@/lib/payments/types";

import {
  createSettlementEventOnce,
} from "./settlement.event";

import {
  createSettlementJournalOnce,
} from "./settlement.journal";
import {
  sendNotification,
} from "@/lib/services/notifications.service";
import {
  logger,
  maskId,
} from "@/lib/logger";
/* =====================================================
   DB CLIENT TYPE
===================================================== */

type TransactionClient = {
  query: <T>(
    sql: string,
    params?: unknown[]
  ) => Promise<{
    rows: T[];
    rowCount: number | null;
  }>;
};

/* =====================================================
   FIND RELEASABLE ESCROWS
===================================================== */

export async function findReleasableEscrows(
  client: TransactionClient
): Promise<EscrowReleaseRow[]> {

  logger.info("SETTLEMENT.RELEASE.FIND_START");

  const { rows } =
    await client.query<EscrowReleaseRow>(
      `

  SELECT
  id,
  order_id,
  buyer_id,
  payment_intent_id,
  seller_id,
  amount,
  status,
  release_status,
  release_after
FROM escrow_entries

      WHERE
        release_status = 'HOLD'
        AND status = 'PAID'
        AND release_after IS NOT NULL
        AND release_after <= NOW()
      FOR UPDATE SKIP LOCKED
      `
    );

  logger.info("SETTLEMENT.RELEASE.FIND_DONE", {
  total: rows.length,
});

  return rows;
}

/* =====================================================
   RELEASE ESCROW FLOW
===================================================== */

export async function releaseEscrowFlow(
  input: ReleaseEscrowFlowInput
): Promise<void> {

  const {
    client,
    escrow,
  } = input;
if (!escrow.payment_intent_id) {
  throw new Error("PAYMENT_INTENT_ID_REQUIRED");
}

const rpc =
  await getRpcVerificationLog(
    escrow.payment_intent_id
  );

if (!rpc) {
  throw new Error("RPC_LOG_NOT_FOUND");
}
if (!rpc.verified) {
  throw new Error("RPC_NOT_VERIFIED");
}
if (!rpc.confirmed) {
  throw new Error("RPC_NOT_CONFIRMED");
}

if (rpc.txStatus !== "SUCCESS") {
  throw new Error("RPC_TX_FAILED");
}
  logger.info("SETTLEMENT.RELEASE.START", {
  escrowId: maskId(escrow.id),
  orderId: maskId(escrow.order_id),
  sellerId: maskId(escrow.seller_id),
});

  const amount = Number(escrow.amount);

if (Number.isNaN(amount) || amount <= 0) {
  logger.error("SETTLEMENT.RELEASE.INVALID_AMOUNT", {
  escrowId: maskId(escrow.id),
});

  throw new Error("INVALID_ESCROW_AMOUNT");
}

  /* ===================================================
     1. RELEASE ESCROW
  =================================================== */

  logger.debug("SETTLEMENT.RELEASE.ESCROW_UPDATE_START", {
  escrowId: maskId(escrow.id),
});

  const escrowUpdate =
  await client.query(
    `
    UPDATE escrow_entries

    SET
      status = 'SETTLED',

      release_status =
        'RELEASED',

      released_amount =
        amount,

      released_at =
        NOW(),

      updated_at =
        NOW(),

      escrow_version =
        escrow_version + 1

    WHERE id = $1
      AND release_status = 'HOLD'
    `,
    [
      escrow.id,
    ]
  );

/* ===================================================
   IDEMPOTENT GUARD
=================================================== */

if (
  escrowUpdate.rowCount !== 1
) {

  logger.warn("SETTLEMENT.RELEASE.ALREADY_RELEASED", {
  escrowId: maskId(escrow.id),
});

  return;
}

logger.info("SETTLEMENT.RELEASE.ESCROW_UPDATED", {
  escrowId: maskId(escrow.id),
});

  const sellerCreditUpdate =
    await client.query(
      `
      UPDATE seller_credits

SET
  status = 'AVAILABLE',

  available_amount =
    available_amount + amount,

  frozen_amount =
    frozen_amount - amount,

  released_at = NOW(),
  updated_at = NOW(),
  ledger_version = ledger_version + 1

WHERE escrow_id = $1
  AND status = 'FROZEN'
  AND frozen_amount >= amount
      `,
      [
        escrow.id,
      ]
    );
logger.info("SETTLEMENT.RELEASE.CREDIT_UPDATED", {
  escrowId: maskId(escrow.id),
});

/* ===================================================
   IDEMPOTENT CREDIT GUARD
=================================================== */

if (
  sellerCreditUpdate.rowCount !== 1
) {

  throw new Error(
    "SELLER_CREDIT_RELEASE_FAILED"
  );
}

  /* ===================================================
     3. ENSURE WALLET
  =================================================== */

  logger.debug("SETTLEMENT.RELEASE.ENSURE_WALLET_START", {
  sellerId: maskId(escrow.seller_id),
});

  await client.query(
    `
    INSERT INTO wallets (
      user_id,
      balance,
      available_balance,
      pending_balance,
      frozen_balance,
      wallet_version,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      0,
      0,
      0,
      0,
      1,
      NOW(),
      NOW()
    )

    ON CONFLICT (user_id)
    DO NOTHING
    `,
    [
      escrow.seller_id,
    ]
  );

  logger.debug("SETTLEMENT.RELEASE.ENSURE_WALLET_DONE", {
  sellerId: maskId(escrow.seller_id),
});

  /* ===================================================
     4. CREDIT WALLET
  =================================================== */

  logger.debug("SETTLEMENT.RELEASE.WALLET_CREDIT_START", {
  sellerId: maskId(escrow.seller_id),
});

  const walletUpdate =
    await client.query(
      `
      UPDATE wallets

      SET

        balance =
          balance + $1,

        available_balance =
          available_balance + $1,

        wallet_version =
          wallet_version + 1,

        last_credit_at =
          NOW(),

        updated_at =
          NOW()

      WHERE user_id = $2
      `,
      [
        amount,
        escrow.seller_id,
      ]
    );

  logger.info("SETTLEMENT.RELEASE.WALLET_CREDIT_DONE", {
  sellerId: maskId(escrow.seller_id),
});
if (walletUpdate.rowCount !== 1) {
  throw new Error(
    "WALLET_CREDIT_FAILED"
  );
}
  /* ===================================================
     5. JOURNAL
  =================================================== */

  logger.debug("SETTLEMENT.RELEASE.JOURNAL_START", {
  escrowId: maskId(escrow.id),
});

  await createSettlementJournalOnce(
  {
    ownerId:
      escrow.seller_id,

    ownerType:
      "SELLER",

    refId:
      escrow.id,

    refTable:
      "escrow_entries",

    entryType:
      "SELLER_ESCROW_RELEASE",

    direction:
      "CREDIT",

    amount,

    note:
      "Escrow released to seller wallet",
  },

  client
);

  logger.info("SETTLEMENT.RELEASE.JOURNAL_DONE", {
  escrowId: maskId(escrow.id),
});

  /* ===================================================
     6. COMPLETE ORDER
  =================================================== */

  logger.debug("SETTLEMENT.RELEASE.ORDER_COMPLETE_START", {
  orderId: maskId(escrow.order_id),
});
/* ===================================================
   8. FINALIZE PAYMENT INTENT
=================================================== */

if (escrow.payment_intent_id) {

  logger.debug("SETTLEMENT.RELEASE.INTENT_SETTLE_START", {
  paymentIntentId: maskId(escrow.payment_intent_id),
});

  const intentUpdate =
    await client.query(
      `
      UPDATE payment_intents
      SET
        settlement_state = 'SETTLED',
        settled_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
        AND settlement_state <> 'SETTLED'
      `,
      [
        escrow.payment_intent_id,
      ]
    );

  logger.info("SETTLEMENT.RELEASE.INTENT_SETTLED", {
  paymentIntentId: maskId(escrow.payment_intent_id),
});
}
  const orderUpdate =
    await client.query(
      `
      UPDATE orders
SET
  fulfillment_status = 'completed',
  settlement_status = 'SETTLED',
  shipment_status = 'DELIVERED',
  delivery_status = 'DELIVERED',
  completed_at = NOW(),
  updated_at = NOW()
WHERE id = $1
  AND fulfillment_status <> 'completed'
      `,
      [
        escrow.order_id,
      ]
    );

  logger.info("SETTLEMENT.RELEASE.ORDER_COMPLETED", {
  orderId: maskId(escrow.order_id),
});

  /* ===================================================
     7. COMPLETE ORDER ITEMS
  =================================================== */

  logger.debug("SETTLEMENT.RELEASE.ORDER_ITEMS_START", {
  orderId: maskId(escrow.order_id),
});

  const orderItemsUpdate =
    await client.query(
      `
      UPDATE order_items

      SET
        fulfillment_status =
          'completed',

        completed_at =
          NOW(),

        updated_at =
          NOW()

      WHERE order_id = $1
        AND fulfillment_status IN (
          'shipped',
          'delivered'
        )
      `,
      [
        escrow.order_id,
      ]
    );

  logger.info("SETTLEMENT.RELEASE.ORDER_ITEMS_DONE", {
  orderId: maskId(escrow.order_id),
});

  /* ===================================================
     8. EVENT
  =================================================== */

  logger.debug("SETTLEMENT.RELEASE.EVENT_START", {
  escrowId: maskId(escrow.id),
});

  await createSettlementEventOnce(
  {
    escrowId:
      escrow.id,

    type:
      "AUTO_RELEASE",

    source:
      "system",

    reason:
      "ESCROW_AUTO_RELEASED",

    metadata: {
      orderId:
        escrow.order_id,

      sellerId:
        escrow.seller_id,

      amount,
    },
  },

  client
);

  logger.info("SETTLEMENT.RELEASE.EVENT_DONE", {
  escrowId: maskId(escrow.id),
});
/* ===================================================
   9. NOTIFICATIONS
=================================================== */

try {

  await sendNotification({
    userId: escrow.seller_id,
    type: "order_completed",
    category: "wallet",
    title: "Tiền đã được giải ngân",
    message:
      "Tiền từ đơn hàng đã được chuyển vào ví khả dụng của bạn.",
    orderId: escrow.order_id,
    priority: "high",
  });

  const orderResult = await client.query<{
    buyer_id: string;
  }>(
    `
    SELECT buyer_id
    FROM orders
    WHERE id = $1
    LIMIT 1
    `,
    [escrow.order_id]
  );

  if (orderResult.rows.length) {

    await sendNotification({
      userId: orderResult.rows[0].buyer_id,
      type: "order_completed",
      category: "order",
      title: "Đơn hàng đã hoàn thành",
      message:
        "Đơn hàng của bạn đã hoàn tất.",
      orderId: escrow.order_id,
      priority: "normal",
    });

  }

} catch (err) {

  logger.error("SETTLEMENT.RELEASE.NOTIFICATION_FAILED", {
  escrowId: maskId(escrow.id),
  orderId: maskId(escrow.order_id),
  message:
    err instanceof Error
      ? err.message
      : String(err),
});
}
  /* ===================================================
     COMPLETE
  =================================================== */

  logger.info("SETTLEMENT.RELEASE.SUCCESS", {
  escrowId: maskId(escrow.id),
  orderId: maskId(escrow.order_id),
  sellerId: maskId(escrow.seller_id),
});
}
