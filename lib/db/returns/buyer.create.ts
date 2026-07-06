import { withTransaction } from "@/lib/db";
import { sendNotification } from "@/lib/services/notifications.service";

import {
  isValidUuid,
  error,
} from "./buyer.validator";

import {
  toNumberSafe,
} from "./buyer.helper";
export async function createReturn(
  buyerId: string,
  orderId: string,
  orderItemId: string,
  reason: string,
  description: string,
  images: string[]
): Promise<string> {
  if (
    !isValidUuid(buyerId) ||
    !isValidUuid(orderId) ||
    !isValidUuid(orderItemId)
  ) {
    error("INVALID_INPUT");
  }

  if (!reason.trim()) {
    error("INVALID_REASON");
  }

  const result =
  await withTransaction(async (client) => {
    const { rows: orderRows } =
      await client.query<DbOrder>(
        `
        SELECT
          id,
          seller_id,
          fulfillment_status
        FROM orders
        WHERE id = $1
          AND buyer_id = $2
        LIMIT 1
        `,
        [orderId, buyerId]
      );

    const order = orderRows[0];

    if (!order) {
      error("ORDER_NOT_FOUND");
    }

    if (
      !["delivered", "completed"].includes(
        order.fulfillment_status
      )
    ) {
      error("ORDER_NOT_RETURNABLE");
    }

    const { rows: itemRows } =
      await client.query<DbOrderItem>(
        `
        SELECT
          id,
          product_id,
          variant_id,
          product_name,
          product_slug,
          thumbnail,
          unit_price,
          quantity
        FROM order_items
        WHERE id = $1
          AND order_id = $2
        LIMIT 1
        `,
        [orderItemId, orderId]
      );

    const item = itemRows[0];

    if (!item) {
      error("ITEM_NOT_FOUND");
    }

    const { rows: existing } =
      await client.query(
        `
        SELECT 1
        FROM return_items ri
        JOIN returns r
          ON r.id = ri.return_id
        WHERE ri.order_item_id = $1
          AND r.deleted_at IS NULL
          AND r.status <> 'cancelled'
        LIMIT 1
        `,
        [orderItemId]
      );

    if (existing.length > 0) {
      error("RETURN_EXISTS");
    }

    const unitPrice = toNumberSafe(
      item.unit_price,
      "unit_price"
    );

    const quantity = toNumberSafe(
      item.quantity,
      "quantity"
    );

    const totalPrice =
      unitPrice * quantity;

    const refundAmount =
      totalPrice;

    const returnNumber =
      `RET-${Date.now()}`;

    const { rows: returnRows } =
      await client.query<{
        id: string;
      }>(
        `
        INSERT INTO returns (
          order_id,
          buyer_id,
          seller_id,
          return_number,
          status,
          reason,
          description,
          evidence_images,
          refund_amount
        )
        VALUES (
          $1,$2,$3,$4,
          'pending',
          $5,$6,$7,$8
        )
        RETURNING id
        `,
        [
          orderId,
          buyerId,
          order.seller_id,
          returnNumber,
          reason,
          description ?? "",
          images,
          refundAmount,
        ]
      );

    const returnId =
      returnRows[0].id;
    const itemResult =
  await client.query(
      `
      INSERT INTO return_items (
        return_id,
        order_item_id,
        product_id,
        variant_id,
        product_name,
        product_slug,
        thumbnail,
        unit_price,
        quantity,
        total_price,
        return_quantity,
        refund_amount,
        reason
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8::numeric,
        $9::integer,
        $10::numeric,
        $11::integer,
        $12::numeric,
        $13
      )
      `,
      [
        returnId,
        orderItemId,
        item.product_id,
        item.variant_id,
        item.product_name,
        item.product_slug,
        item.thumbnail,
        unitPrice,
        quantity,
        totalPrice,
        quantity,
        refundAmount,
        reason,
      ]
    );
if (
  itemResult.rowCount !== 1
) {
  error(
    "FAILED_TO_CREATE_RETURN_ITEM"
  );
    return {
  returnId,
  buyerId,
  sellerId: order.seller_id,
  orderId,
};
  });
   try {

  await sendNotification({
    userId: result.buyerId,
    type: "return_created",
    category: "order",
    title: "Yêu cầu trả hàng đã được gửi",
    message:
      "Yêu cầu trả hàng của bạn đang chờ người bán xử lý.",
    orderId: result.orderId,
    priority: "normal",
  });

  await sendNotification({
    userId: result.sellerId,
    type: "return_created",
    category: "order",
    title: "Có yêu cầu trả hàng mới",
    message:
      "Khách hàng vừa gửi yêu cầu trả hàng cho một đơn hàng.",
    orderId: result.orderId,
    priority: "high",
  });

} catch (err) {

  console.error(
  "[NOTIFICATION][RETURN_CREATED]",
  {
    error:
      err instanceof Error
        ? err.message
        : "UNKNOWN_ERROR",
  }
);
}
   return result.returnId;
}
