import { query, withTransaction } from "@/lib/db";

/* =========================================================
   BUYER — GET RETURNS
========================================================= */
export async function getReturnsByBuyer(userId: string) {
  const { rows } = await query(
    `
    SELECT *
    FROM returns
    WHERE buyer_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );

  return rows;
}

/* =========================================================
   CREATE — RETURN REQUEST
========================================================= */
export async function createReturn(
  userId: string,
  orderId: string,
  orderItemId: string,
  reason: string,
  description: string | null,
  images: string[]
): Promise<void> {
  if (!userId || !orderId || !orderItemId) {
    throw new Error("INVALID_INPUT");
  }

  await withTransaction(async (client) => {
    /* ================= ORDER ================= */
    const { rows: orderRows } = await client.query<{
      id: string;
      buyer_id: string;
      seller_id: string;
      status: string;
    }>(
      `
      SELECT id, buyer_id, seller_id, status
      FROM orders
      WHERE id = $1 AND buyer_id = $2
      LIMIT 1
      `,
      [orderId, userId]
    );

    const order = orderRows[0];

    if (!order) {
      throw new Error("ORDER_NOT_FOUND");
    }

    if (!["completed", "delivered"].includes(order.status)) {
      throw new Error("ORDER_NOT_RETURNABLE");
    }

    /* ================= ITEM ================= */
    const { rows: itemRows } = await client.query<{
      id: string;
      product_id: string;
      quantity: number;
      product_name: string;
      thumbnail: string;
      unit_price: number;
    }>(
      `
      SELECT
        id,
        product_id,
        quantity,
        product_name,
        thumbnail,
        unit_price
      FROM order_items
      WHERE id = $1 AND order_id = $2
      LIMIT 1
      `,
      [orderItemId, orderId]
    );

    const item = itemRows[0];

    if (!item) {
      throw new Error("ITEM_NOT_FOUND");
    }

    /* ================= DUPLICATE CHECK ================= */
    const { rows: existing } = await client.query(
      `
      SELECT id
      FROM returns
      WHERE order_item_id = $1
      LIMIT 1
      `,
      [orderItemId]
    );

    if (existing.length > 0) {
      throw new Error("RETURN_EXISTS");
    }

    /* ================= CALC REFUND ================= */
    const refundAmount = item.unit_price * item.quantity;

    /* ================= INSERT ================= */
    await client.query(
      `
      INSERT INTO returns (
        order_id,
        order_item_id,
        product_id,
        seller_id,
        buyer_id,
        product_name,
        product_thumbnail,
        quantity,
        reason,
        description,
        images,
        refund_amount,
        status
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,
        $9,$10,$11,
        $12,'pending'
      )
      `,
      [
        orderId,
        orderItemId,
        item.product_id,
        order.seller_id,
        userId,
        item.product_name,
        item.thumbnail,
        item.quantity,
        reason,
        description,
        JSON.stringify(images),
        refundAmount,
      ]
    );

    console.log("🟢 [RETURN] CREATED", {
      orderId,
      orderItemId,
      refundAmount,
    });
  });
}
