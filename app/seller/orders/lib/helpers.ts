import type {
  Order,
  OrderItem,
  OrderStats,
  OrderStatus,
  RawOrder,
  RawOrderItem,
} from "../types";

/* =========================================================
   STATUS
========================================================= */

export function normalizeStatus(
  value?: string | null
): OrderStatus {
  switch ((value ?? "").trim().toLowerCase()) {
    case "pending":
      return "pending";

    case "pending_fulfillment":
      return "pending_fulfillment";

    case "processing":
      return "processing";

    case "shipped":
      return "shipped";

    case "delivered":
      return "delivered";

    case "completed":
      return "completed";

    case "cancelled":
      return "cancelled";

    default:
      return "pending";
  }
}

/* =========================================================
   NUMBER
========================================================= */

function normalizeNumber(
  value: unknown
): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

/* =========================================================
   ITEM
========================================================= */

export function normalizeItem(
  item: RawOrderItem
): OrderItem {
  return {
    id: item.id,

    order_id: item.order_id,
    seller_id: item.seller_id,

    product_id: item.product_id,
    variant_id: item.variant_id,

    product_name: item.product_name,
    product_slug: item.product_slug,

    thumbnail: item.thumbnail,

    images: item.images ?? [],

    variant_name: item.variant_name,
    variant_value: item.variant_value,

    is_digital: item.is_digital,

    quantity: Number(item.quantity),

    unit_price: normalizeNumber(
      item.unit_price
    ),

    total_price: normalizeNumber(
      item.total_price
    ),

    currency: item.currency,

    fulfillment_status:
      normalizeStatus(
        item.fulfillment_status
      ),

    confirmed_at:
      item.confirmed_at,

    processing_at:
      item.processing_at,

    shipped_at:
      item.shipped_at,

    delivered_at:
      item.delivered_at,

    completed_at:
      item.completed_at,

    tracking_code:
      item.tracking_code,

    shipping_provider:
      item.shipping_provider,

    seller_message:
      item.seller_message,

    seller_cancel_reason:
      item.seller_cancel_reason,

    refunded_amount:
      normalizeNumber(
        item.refunded_amount
      ),

    refunded_at:
      item.refunded_at,

    cost_price:
      item.cost_price == null
        ? null
        : normalizeNumber(
            item.cost_price
          ),

    profit_amount:
      item.profit_amount == null
        ? null
        : normalizeNumber(
            item.profit_amount
          ),

    snapshot:
      item.snapshot,

    seller_payout_status:
      item.seller_payout_status,

    seller_release_at:
      item.seller_release_at,

    seller_released_at:
      item.seller_released_at,

    created_at:
      item.created_at,

    updated_at:
      item.updated_at,
  };
}
/* =========================================================
   ORDER
========================================================= */

export function normalizeOrder(
  raw: RawOrder
): Order {
  return {
    id: raw.id,

    order_number: raw.order_number,

    buyer_id: raw.buyer_id,
    seller_id: raw.seller_id,

    pi_payment_id: raw.pi_payment_id,
    pi_txid: raw.pi_txid,
    idempotency_key: raw.idempotency_key,

    payment_status: raw.payment_status,

    fulfillment_status:
      normalizeStatus(
        raw.fulfillment_status
      ),

    return_status:
      raw.return_status ?? null,

    items_total:
      normalizeNumber(
        raw.items_total
      ),

    subtotal:
      normalizeNumber(
        raw.subtotal
      ),

    discount:
      normalizeNumber(
        raw.discount
      ),

    shipping_fee:
      normalizeNumber(
        raw.shipping_fee
      ),

    tax:
      normalizeNumber(
        raw.tax
      ),

    total:
      normalizeNumber(
        raw.total
      ),

    currency:
      raw.currency,

    total_items:
      raw.total_items,

    total_quantity:
      raw.total_quantity,

    created_at:
      raw.created_at,

    updated_at:
      raw.updated_at,

    paid_at:
      raw.paid_at,

    refunded_at:
      raw.refunded_at,

    fulfillment_started_at:
      raw.fulfillment_started_at,

    processing_at:
      raw.processing_at,

    shipped_at:
      raw.shipped_at,

    delivered_at:
      raw.delivered_at,

    completed_at:
      raw.completed_at,

    cancelled_at:
      raw.cancelled_at,

    cancel_reason:
      raw.cancel_reason,

    shipping_name:
      raw.shipping_name,

    shipping_phone:
      raw.shipping_phone,

    shipping_address_line:
      raw.shipping_address_line,

    shipping_ward:
      raw.shipping_ward,

    shipping_district:
      raw.shipping_district,

    shipping_region:
      raw.shipping_region,

    shipping_country:
      raw.shipping_country,

    shipping_postal_code:
      raw.shipping_postal_code,

    shipping_provider:
      raw.shipping_provider,

    shipping_zone:
      raw.shipping_zone,

    buyer_note:
      raw.buyer_note,

    admin_note:
      raw.admin_note,

    settlement_status:
      raw.settlement_status,

    shipment_status:
      raw.shipment_status,

    delivery_status:
      raw.delivery_status,

    order_items:
      (raw.order_items ?? []).map(
        normalizeItem
      ),
  };
}
/* =========================================================
   FILTER
========================================================= */

export function filterOrders(
  orders: Order[],
  keyword = ""
): Order[] {
  const q = keyword.trim().toLowerCase();

  if (!q) {
    return orders;
  }

  return orders.filter((order) => {
    return (
      order.order_number
        .toLowerCase()
        .includes(q) ||

      order.shipping_name
        .toLowerCase()
        .includes(q) ||

      order.shipping_phone
        .toLowerCase()
        .includes(q)
    );
  });
}

/* =========================================================
   STATS
========================================================= */

export function calculateStats(
  orders: Order[]
): OrderStats {
  const stats: OrderStats = {
    all: orders.length,

    pending: 0,

    pending_fulfillment: 0,

    processing: 0,

    shipped: 0,

    delivered: 0,

    completed: 0,

    cancelled: 0,
  };

  for (const order of orders) {
    switch (order.fulfillment_status) {
      case "pending":
        stats.pending++;
        break;

      case "pending_fulfillment":
        stats.pending_fulfillment++;
        break;

      case "processing":
        stats.processing++;
        break;

      case "shipped":
        stats.shipped++;
        break;

      case "delivered":
        stats.delivered++;
        break;

      case "completed":
        stats.completed++;
        break;

      case "cancelled":
        stats.cancelled++;
        break;
    }
  }

  return stats;
}

/* =========================================================
   ADDRESS
========================================================= */

export function formatAddress(
  order: Pick<
    Order,
    | "shipping_address_line"
    | "shipping_ward"
    | "shipping_district"
    | "shipping_region"
    | "shipping_country"
  >
): string {
  return [
    order.shipping_address_line,
    order.shipping_ward,
    order.shipping_district,
    order.shipping_region,
    order.shipping_country,
  ]
    .filter(
      (value) =>
        value &&
        String(value).trim().length > 0
    )
    .join(", ");
}
