import { query, withTransaction } from "@/lib/db";
import type {
  Order as BuyerOrderRow,
} from "@/types/orders";
import {
  sendNotification,
} from "@/lib/services/notifications.service";
import {
  logger,
  maskId,
} from "@/lib/logger";
/* =========================================================
   BUYER — ORDERS LIST
========================================================= */

export async function getOrdersByBuyer(
  userId: string
): Promise<BuyerOrderRow[]> {
  const { rows } = await query<BuyerOrderRow>(
    `
    SELECT
      o.id,
      o.order_number,

      o.pi_payment_id,
      o.pi_txid,
      o.idempotency_key,

      o.payment_status,
      o.fulfillment_status,

      rt.status AS return_status,

      o.total,
      o.currency,

      o.items_total,
      o.subtotal,
      o.discount,
      o.shipping_fee,
      o.tax,

      o.created_at,
      o.updated_at,

      o.paid_at,
      o.refunded_at,

      o.fulfillment_started_at,
      o.processing_at,
      o.shipped_at,
      o.delivered_at,
      o.completed_at,

      o.cancelled_at,
      o.cancel_reason,

      o.shipping_name,
      o.shipping_phone,
      o.shipping_address_line,

      o.shipping_ward,
      o.shipping_district,
      o.shipping_region,

      o.shipping_country,
      o.shipping_postal_code,

      o.shipping_provider,
      o.shipping_zone,

      o.buyer_note,
      o.admin_note,

      o.total_items,
      o.total_quantity,

      o.settlement_status,
      o.shipment_status,
      o.delivery_status,

      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,

            'product_id', oi.product_id,
            'variant_id', oi.variant_id,

            'product_name', oi.product_name,
            'product_slug', oi.product_slug,

            'thumbnail', oi.thumbnail,
            'images', oi.images,

            'variant_name', oi.variant_name,
            'variant_value', oi.variant_value,

            'is_digital', oi.is_digital,

            'quantity', oi.quantity,

            'unit_price', oi.unit_price,
            'total_price', oi.total_price,

            'currency', oi.currency,

            'fulfillment_status', oi.fulfillment_status,

            'confirmed_at', oi.confirmed_at,
            'processing_at', oi.processing_at,
            'shipped_at', oi.shipped_at,
            'delivered_at', oi.delivered_at,
            'completed_at', oi.completed_at,

            'tracking_code', oi.tracking_code,
            'shipping_provider', oi.shipping_provider,

            'seller_message', oi.seller_message,
            'seller_cancel_reason', oi.seller_cancel_reason,

            'snapshot', oi.snapshot
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
      ) AS order_items

    FROM orders o

    LEFT JOIN order_items oi
      ON oi.order_id = o.id

    LEFT JOIN LATERAL (
      SELECT r.status
      FROM returns r
      WHERE r.order_id = o.id
        AND r.deleted_at IS NULL
      ORDER BY r.created_at DESC
      LIMIT 1
    ) rt ON TRUE

    WHERE o.buyer_id = $1
      AND o.deleted_at IS NULL

    GROUP BY
      o.id,
      rt.status

    ORDER BY o.created_at DESC
    `,
    [userId]
  );

  return rows ?? [];
}
/* =========================================================
   BUYER — COUNTS
========================================================= */

export type BuyerOrderCounts = {
  pending_fulfillment: number;
  processing: number;
  shipped: number;
  delivered: number;
  completed: number;
  cancelled: number;
  refunded: number;
};

export async function getBuyerOrderCounts(
  userId: string
): Promise<BuyerOrderCounts> {
  const { rows } = await query<{
    fulfillment_status: string;
    total: string;
  }>(
    `
    SELECT
      fulfillment_status,
      COUNT(*)::int AS total
    FROM orders
    WHERE buyer_id = $1
      AND deleted_at IS NULL
    GROUP BY fulfillment_status
    `,
    [userId]
  );

  const counts: BuyerOrderCounts = {
    pending_fulfillment: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    completed: 0,
    cancelled: 0,
    refunded: 0,
  };

  for (const row of rows) {
    const status = row.fulfillment_status as keyof BuyerOrderCounts;
    const total = Number(row.total || 0);

    if (status in counts) {
      counts[status] = total;
    }
  }

  return counts;
}

/* =========================================================
   BUYER — ORDER DETAIL
========================================================= */

export async function getOrderByBuyerId(
  orderId: string,
  userId: string
): Promise<BuyerOrderRow | null> {
  const { rows } = await query<BuyerOrderRow>(
    `
    SELECT
      o.id,
      o.order_number,

      o.pi_payment_id,
      o.pi_txid,
      o.idempotency_key,

      o.payment_status,
      o.fulfillment_status,

      rt.status AS return_status,

      o.total,
      o.currency,

      o.items_total,
      o.subtotal,
      o.discount,
      o.shipping_fee,
      o.tax,

      o.created_at,
      o.updated_at,

      o.paid_at,
      o.refunded_at,

      o.fulfillment_started_at,
      o.processing_at,
      o.shipped_at,
      o.delivered_at,
      o.completed_at,

      o.cancelled_at,
      o.cancel_reason,

      o.shipping_name,
      o.shipping_phone,
      o.shipping_address_line,

      o.shipping_ward,
      o.shipping_district,
      o.shipping_region,

      o.shipping_country,
      o.shipping_postal_code,

      o.shipping_provider,
      o.shipping_zone,

      o.buyer_note,
      o.admin_note,

      o.total_items,
      o.total_quantity,

      o.settlement_status,
      o.shipment_status,
      o.delivery_status,

      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,

            'product_id', oi.product_id,
            'variant_id', oi.variant_id,

            'product_name', oi.product_name,
            'product_slug', oi.product_slug,

            'thumbnail', oi.thumbnail,
            'images', oi.images,

            'variant_name', oi.variant_name,
            'variant_value', oi.variant_value,

            'is_digital', oi.is_digital,

            'quantity', oi.quantity,

            'unit_price', oi.unit_price,
            'total_price', oi.total_price,

            'currency', oi.currency,

            'fulfillment_status', oi.fulfillment_status,

            'confirmed_at', oi.confirmed_at,
            'processing_at', oi.processing_at,
            'shipped_at', oi.shipped_at,
            'delivered_at', oi.delivered_at,
            'completed_at', oi.completed_at,

            'tracking_code', oi.tracking_code,
            'shipping_provider', oi.shipping_provider,

            'seller_message', oi.seller_message,
            'seller_cancel_reason', oi.seller_cancel_reason,

            'snapshot', oi.snapshot
            ORDER BY oi.created_at ASC
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
      ) AS order_items

    FROM orders o

    LEFT JOIN order_items oi
      ON oi.order_id = o.id

    LEFT JOIN LATERAL (
      SELECT r.status
      FROM returns r
      WHERE r.order_id = o.id
        AND r.deleted_at IS NULL
      ORDER BY r.created_at DESC
      LIMIT 1
    ) rt ON TRUE

    WHERE o.id = $1
      AND o.buyer_id = $2
      AND o.deleted_at IS NULL

    GROUP BY
      o.id,
      rt.status
    `,
    [orderId, userId]
  );

  return rows[0] ?? null;
}
/* =========================================================
   COMPLETE ORDER
========================================================= */
type CompleteOrderResult = {
  status:
    | "SUCCESS"
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "INVALID_STATUS";
  buyerId?: string;
  sellerId?: string;
  orderId?: string;
};
export async function completeOrderByBuyer(
  orderId: string,
  userId: string
): Promise<
  | "SUCCESS"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_STATUS"
> {

  const result =
  await withTransaction(
    async (client) => {

      /* =====================================================
         1. GET ORDER
      ===================================================== */

      const { rows } =
  await client.query<{
    buyer_id: string;
    seller_id: string;
    fulfillment_status: string;
  }>(
    `
    SELECT
      buyer_id,
      seller_id,
      fulfillment_status
    FROM orders
    WHERE id = $1
    LIMIT 1
    `,
    [orderId]
  );

      const order =
        rows[0];

      if (!order) {
        return {
  status: "NOT_FOUND",
};
      }

      if (
        order.buyer_id !==
        userId
      ) {
        return {
  status: "FORBIDDEN",
};
      }

      /* =====================================================
         2. ONLY SHIPPED → DELIVERED
      ===================================================== */

      if (
        order.fulfillment_status !==
        "shipped"
      ) {
        return "INVALID_STATUS";
      }

      /* =====================================================
         3. UPDATE ORDER ITEMS
      ===================================================== */

      await client.query(
        `
        UPDATE order_items

        SET
          fulfillment_status = 'delivered',
          delivered_at = NOW(),
          updated_at = NOW()
        WHERE order_id = $1
          AND fulfillment_status = 'shipped'
        `,
        [orderId]
      );

      /* =====================================================
         4. UPDATE MAIN ORDER
      ===================================================== */

      await client.query(
        `
        UPDATE orders

        SET
          fulfillment_status = 'delivered',
          delivered_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        `,
        [orderId]
      );

      /* =====================================================
         5. SET AUTO COMPLETE TIMER

         IMPORTANT:
         - NO payout here
         - NO wallet update here
         - only schedule auto settlement

         FLOW:
         delivered
         → 1 hour wait
         → cron auto complete
      ===================================================== */

      const escrowUpdate =
  await client.query(
    `
    UPDATE escrow_entries

    SET
      release_after =
        NOW() + interval '5 minutes',

      updated_at = NOW()

    WHERE order_id = $1

    RETURNING
      id,
      status,
      release_status,
      release_after
    `,
    [orderId]
  );

logger.debug(
  "ESCROW.AUTO_TIMER_SET",
  {
    orderId: maskId(orderId),
    rowCount: escrowUpdate.rowCount,
  }
);

  
      logger.info(
  "ORDER.BUYER.DELIVERED",
  {
    orderId: maskId(orderId),
    buyerId: maskId(userId),
  }
);

      return {
  status: "SUCCESS",
  buyerId: order.buyer_id,
  sellerId: order.seller_id,
  orderId,
};
    }
  );
  if (result.status === "SUCCESS") {

  try {

    await sendNotification({
      userId: result.buyerId,
      type: "order_completed",
      category: "order",
      title: "Đã xác nhận nhận hàng",
      message: "Bạn đã xác nhận nhận hàng thành công.",
      orderId: result.orderId,
    });

    await sendNotification({
      userId: result.sellerId,
      type: "order_completed",
      category: "order",
      title: "Đơn hàng đã hoàn thành",
      message: "Khách hàng đã xác nhận đã nhận hàng.",
      orderId: result.orderId,
      priority: "high",
    });

  } catch (err) {

    logger.error(
  "NOTIFICATION.ORDER_COMPLETED.ERROR",
  {
    message:
      err instanceof Error
        ? err.message
        : "UNKNOWN",
  }
);

  }

}
  return result.status;
}
/* =========================================================
   CANCEL ORDER
========================================================= */

export async function cancelOrderByBuyer(
  orderId: string,
  userId: string,
  reason?: string | null
 ): Promise<{
  status:
    | "SUCCESS"
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "INVALID_STATUS";
  buyerId?: string;
  sellerId?: string;
  orderId?: string;
}> {
 
  const result =
  await withTransaction(async (client) => {
    const { rows } = await client.query<{
  buyer_id: string;
  seller_id: string;
  fulfillment_status: string;
}>(
      `
      SELECT
  buyer_id,
  seller_id,
  fulfillment_status
FROM orders
WHERE id = $1
      `,
      [orderId]
    );

    const order = rows[0];
    if (!order) {
  return {
    status: "NOT_FOUND",
  };
}
    if (order.buyer_id !== userId) {
  return {
    status: "FORBIDDEN",
  };
}

    if (
      !["pending", "pending_fulfillment", "processing"].includes(
        order.fulfillment_status
      )
    ) {
      return {
  status: "INVALID_STATUS",
};
    }

    await client.query(
      `
      UPDATE order_items
      SET fulfillment_status = 'cancelled',
          seller_cancel_reason = COALESCE($2, seller_cancel_reason),
          updated_at = NOW()
      WHERE order_id = $1
      `,
      [orderId, reason ?? null]
    );

    await client.query(
      `
      UPDATE orders
      SET fulfillment_status = 'cancelled',
          cancelled_at = NOW(),
          cancel_reason = COALESCE($2, cancel_reason),
          updated_at = NOW()
      WHERE id = $1
      `,
      [orderId, reason ?? null]
    );

    return {
  status: "SUCCESS",
  buyerId: order.buyer_id,
  sellerId: order.seller_id,
  orderId,
};
  });
  if (result.status === "SUCCESS") {

  try {

    await sendNotification({
      userId: result.buyerId!,
      type: "order_cancelled",
      category: "order",
      title: "Đã hủy đơn hàng",
      message: "Bạn đã hủy đơn hàng thành công.",
      orderId: result.orderId!,
    });

    await sendNotification({
      userId: result.sellerId!,
      type: "order_cancelled",
      category: "order",
      title: "Đơn hàng đã bị hủy",
      message: "Người mua đã hủy đơn hàng.",
      orderId: result.orderId!,
      priority: "high",
    });

  } catch (err) {

    logger.error(
  "NOTIFICATION.ORDER_CANCELLED.ERROR",
  {
    message:
      err instanceof Error
        ? err.message
        : "UNKNOWN",
  }
);

  }

}

return result.status;
}
