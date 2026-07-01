import {  query,  withTransaction,} from "@/lib/db";

/* =========================================================
   VALIDATION
========================================================= */

function isUUID(id: string) {
  return typeof id === "string" &&
    /^[0-9a-f-]{36}$/i.test(id);
}

/* =========================================================
   SOURCE OF TRUTH: FULFILLMENT SYNC
========================================================= */

export async function syncOrderFulfillmentStatus(
  client: PoolClient,
  orderId: string
): Promise<void> {
  if (!isUUID(orderId)) {
    throw new Error("INVALID_ORDER_ID");
  }

  const { rows } = await client.query<{
    payment_status: string;
    fulfillment_status: string;
  }>(
    `
    SELECT
      payment_status,
      fulfillment_status
    FROM orders
    WHERE id = $1
    `,
    [orderId]
  );

  const order = rows[0];
  if (!order) return;
   console.log(
  "[SYNC][ORDER]",
  {
    orderId,
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
  }
);
const itemStatusResult =
  await client.query<{
    fulfillment_status: string;
    total: string;
  }>(
    `
    SELECT
      fulfillment_status,
      COUNT(*)::int AS total
    FROM order_items
    WHERE order_id = $1
    GROUP BY fulfillment_status
    `,
    [orderId]
  );

const statusMap = new Map(
  itemStatusResult.rows.map((r) => [
    r.fulfillment_status,
    Number(r.total),
  ])
);

const totalItems =
  itemStatusResult.rows.reduce(
    (sum, r) => sum + Number(r.total),
    0
  );
   console.log(
  "[SYNC][ITEM_STATUS]",
  {
    orderId,
    totalItems,
    rows: itemStatusResult.rows,
    statusMap: Object.fromEntries(statusMap),
  }
);
  /* =====================================================
     RULE: ONLY ALLOW PROGRESSION IF PAID
  ===================================================== */

  if (order.payment_status !== "paid") {
    return;
  }
let nextStatus =
  order.fulfillment_status;

const cancelled =
  statusMap.get("cancelled") ?? 0;

console.log(
  "[SYNC][CANCEL_CHECK]",
  {
    orderId,
    cancelled,
    totalItems,
    allCancelled:
      cancelled === totalItems,
  }
);

if (
  totalItems > 0 &&
  cancelled === totalItems
) {

  await client.query(
    `
    UPDATE orders
    SET
      fulfillment_status = 'cancelled',
      cancelled_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    `,
    [orderId]
  );

  console.log(
    "[ORDER][FULFILLMENT_SYNC]",
    {
      orderId,
      from: order.fulfillment_status,
      to: "cancelled",
    }
  );

  return;
}

  /* =====================================================
     STATE MACHINE (SIMPLE + SAFE)
  ===================================================== */
console.log(
  "[SYNC][BEFORE_SWITCH]",
  {
    current: order.fulfillment_status,
    nextStatus,
  }
);
  switch (order.fulfillment_status) {
    case "pending":
      nextStatus = "pending_fulfillment";
      break;

    case "pending_fulfillment":
      nextStatus = "processing";
      break;

    case "processing":
      // usually seller action
      break;

    case "shipped":
      // wait delivery confirmation
      break;

    case "delivered":
      nextStatus = "completed";
      break;

    case "cancelled":
  break;

  case "completed":
  break;

  default:
  return;
  }

  if (nextStatus === order.fulfillment_status) {
    return;
  }

  /* =====================================================
     UPDATE ORDER
  ===================================================== */

  await client.query(
    `
    UPDATE orders
    SET
      fulfillment_status = $2,
      updated_at = NOW(),

      fulfillment_started_at = CASE
        WHEN $2 = 'pending_fulfillment'
        THEN NOW()
        ELSE fulfillment_started_at
      END,

      processing_at = CASE
        WHEN $2 = 'processing'
        THEN NOW()
        ELSE processing_at
      END,

      shipped_at = CASE
        WHEN $2 = 'shipped'
        THEN NOW()
        ELSE shipped_at
      END,

      delivered_at = CASE
        WHEN $2 = 'delivered'
        THEN NOW()
        ELSE delivered_at
      END,

      completed_at = CASE
        WHEN $2 = 'completed'
        THEN NOW()
        ELSE completed_at
      END
    WHERE id = $1
    `,
    [orderId, nextStatus]
  );

  console.log("[ORDER][FULFILLMENT_SYNC]", {
    orderId,
    from: order.fulfillment_status,
    to: nextStatus,
  });
}
