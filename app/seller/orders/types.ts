/* =========================================================
   SELLER ORDERS TYPES
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

export interface OrderItem {
  id: string;

  product_id: string | null;
  variant_id: string | null;

  product_name: string;
  product_slug: string;

  thumbnail: string;
  images: string[];

  variant_name: string;
  variant_value: string;

  quantity: number;

  unit_price: number;
  total_price: number;

  currency: string;

  fulfillment_status: OrderStatus;

  tracking_code: string | null;
  shipping_provider: string | null;

  seller_message: string;
  seller_cancel_reason: string;

  confirmed_at: string | null;
  processing_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;

  snapshot: Record<string, unknown> | null;
}

export interface Order {
  id: string;

  order_number: string;

  payment_status: PaymentStatus;
  fulfillment_status: OrderStatus;

  return_status: ReturnStatus | null;

  total: number;
  subtotal: number;

  shipping_fee: number;
  discount: number;
  tax: number;

  currency: string;

  total_items: number;
  total_quantity: number;

  created_at: string;
  updated_at: string;

  paid_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;

  shipping_name: string;
  shipping_phone: string;

  shipping_address_line: string;

  shipping_ward: string | null;
  shipping_district: string | null;
  shipping_region: string | null;

  shipping_country: string;
  shipping_postal_code: string | null;

  buyer_note: string;
  admin_note: string;

  order_items: OrderItem[];
}

export interface OrderFilter {
  keyword: string;

  from: string;
  to: string;

  status: "all" | OrderStatus;
}

export interface OrderStats {
  all: number;

  pending: number;
  pending_fulfillment: number;

  processing: number;

  shipped: number;

  delivered: number;

  completed: number;

  cancelled: number;
}
