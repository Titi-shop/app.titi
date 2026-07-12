/* =========================================================
   SELLER ORDERS TYPES
   Database First Architecture
========================================================= */

/* =========================================================
   STATUS
========================================================= */

export type OrderStatus =
  | "pending"
  | "pending_fulfillment"
  | "processing"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

export type ReturnStatus =
  | "pending"
  | "approved"
  | "shipping_back"
  | "received"
  | "refunded"
  | "rejected";

export type SettlementStatus = string;
export type ShipmentStatus = string;
export type DeliveryStatus = string;
export type SellerPayoutStatus = string;

/* =========================================================
   RAW ORDER ITEM
   100% Database Schema
========================================================= */

export interface RawOrderItem {
  id: string;

  order_id: string;
  seller_id: string;

  product_id: string | null;
  variant_id: string | null;

  product_name: string;
  product_slug: string;

  thumbnail: string;

  images: string[];

  variant_name: string;
  variant_value: string;

  is_digital: boolean;

  unit_price: string;

  quantity: number;

  total_price: string;

  currency: string;

  fulfillment_status: OrderStatus;

  confirmed_at: string | null;
  processing_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;

  tracking_code: string | null;

  shipping_provider: string | null;

  seller_message: string;

  seller_cancel_reason: string;

  refunded_amount: string;

  refunded_at: string | null;

  cost_price: string | null;

  profit_amount: string | null;

  snapshot: Record<string, unknown> | null;

  created_at: string;

  updated_at: string;

  deleted_at: string | null;

  seller_payout_status: SellerPayoutStatus | null;

  seller_release_at: string | null;

  seller_released_at: string | null;
}
/* =========================================================
   RAW ORDER
   100% Database Schema
========================================================= */

export interface RawOrder {
  id: string;

  order_number: string;

  buyer_id: string;
  seller_id: string;

  pi_payment_id: string | null;
  pi_txid: string | null;
  idempotency_key: string | null;

  payment_status: PaymentStatus;

  paid_at: string | null;
  refunded_at: string | null;

  fulfillment_status: OrderStatus;

  fulfillment_started_at: string | null;
  processing_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;

  cancel_reason: string | null;
  cancelled_at: string | null;

  items_total: string;
  subtotal: string;
  discount: string;
  shipping_fee: string;
  tax: string;
  total: string;

  currency: string;

  shipping_name: string;
  shipping_phone: string;

  shipping_address_line: string;

  shipping_ward: string | null;
  shipping_district: string | null;
  shipping_region: string | null;

  shipping_country: string;
  shipping_postal_code: string | null;

  shipping_provider: string | null;
  shipping_zone: string | null;

  buyer_note: string;
  admin_note: string;

  total_items: number;
  total_quantity: number;

  deleted_at: string | null;

  created_at: string;
  updated_at: string;

  settlement_status: SettlementStatus | null;
  shipment_status: ShipmentStatus | null;
  delivery_status: DeliveryStatus | null;

  return_status: ReturnStatus | null;

  order_items: RawOrderItem[];
}
/* =========================================================
   UI ORDER ITEM
========================================================= */

export interface OrderItem {
  id: string;

  order_id: string;
  seller_id: string;

  product_id: string | null;
  variant_id: string | null;

  product_name: string;
  product_slug: string;

  thumbnail: string;
  images: string[];

  variant_name: string;
  variant_value: string;

  is_digital: boolean;

  quantity: number;

  unit_price: number;
  total_price: number;

  currency: string;

  fulfillment_status: OrderStatus;

  confirmed_at: string | null;
  processing_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;

  tracking_code: string | null;
  shipping_provider: string | null;

  seller_message: string;
  seller_cancel_reason: string;

  refunded_amount: number;

  refunded_at: string | null;

  cost_price: number | null;
  profit_amount: number | null;

  snapshot: Record<string, unknown> | null;

  seller_payout_status: SellerPayoutStatus | null;

  seller_release_at: string | null;
  seller_released_at: string | null;

  created_at: string;
  updated_at: string;
}

/* =========================================================
   UI ORDER
========================================================= */

export interface Order {
  id: string;

  order_number: string;

  buyer_id: string;
  seller_id: string;

  pi_payment_id: string | null;
  pi_txid: string | null;
  idempotency_key: string | null;

  payment_status: PaymentStatus;
  fulfillment_status: OrderStatus;

  return_status: ReturnStatus | null;

  items_total: number;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  tax: number;
  total: number;

  currency: string;

  shipping_name: string;
  shipping_phone: string;

  shipping_address_line: string;

  shipping_ward: string | null;
  shipping_district: string | null;
  shipping_region: string | null;

  shipping_country: string;
  shipping_postal_code: string | null;

  shipping_provider: string | null;
  shipping_zone: string | null;

  buyer_note: string;
  admin_note: string;

  total_items: number;
  total_quantity: number;

  paid_at: string | null;
  refunded_at: string | null;

  fulfillment_started_at: string | null;
  processing_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;

  cancelled_at: string | null;
  cancel_reason: string | null;

  created_at: string;
  updated_at: string;

  settlement_status: SettlementStatus | null;
  shipment_status: ShipmentStatus | null;
  delivery_status: DeliveryStatus | null;

  order_items: OrderItem[];
}
