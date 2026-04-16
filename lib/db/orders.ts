import { withTransaction } from "@/lib/db";
export * from "./orders.payment";
export * from "./orders.preview";
export * from "./orders.seller";
export * from "./orders.buyer";
export * from "./orders.return";
export * from "./orders.create";


/* =========================================================
   CORE — SYNC ORDER STATUS (SOURCE OF TRUTH)
========================================================= */
export async function syncOrderStatus(
  client: {
    query: (sql: string, params: unknown[]) => Promise<{ rows: any[] }>
  },
  orderId: string
) {
  const { rows } = await client.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
      COUNT(*) FILTER (WHERE status = 'shipping')::int AS shipping,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
      COUNT(*)::int AS total
    FROM order_items
    WHERE order_id = $1
    `,
    [orderId]
  );

  const r = rows[0];

  let nextStatus: string = "pending";

  if (r.shipping > 0) {
    nextStatus = "shipping";
  } else if (r.completed === r.total && r.total > 0) {
    nextStatus = "completed";
  } else if (r.confirmed > 0) {
    nextStatus = "confirmed";
  } else if (r.cancelled === r.total) {
    nextStatus = "cancelled";
  }

  await client.query(
    `
    UPDATE orders
    SET
      status = $2,
      updated_at = NOW(),
      confirmed_at = CASE WHEN $2='confirmed' THEN NOW() ELSE confirmed_at END,
      shipped_at = CASE WHEN $2='shipping' THEN NOW() ELSE shipped_at END,
      delivered_at = CASE WHEN $2='completed' THEN NOW() ELSE delivered_at END,
      cancelled_at = CASE WHEN $2='cancelled' THEN NOW() ELSE cancelled_at END
    WHERE id = $1
    `,
    [orderId, nextStatus]
  );
}
