import type { ShippingRate } from "@/types/Product";

/* =========================================================
   REGION
========================================================= */

export type Region =
  | "domestic"
  | "sea"
  | "asia"
  | "europe"
  | "north_america"
  | "rest_of_world";

/* =========================================================
   MESSAGE
========================================================= */

export type MessageType =
  | "info"
  | "success"
  | "error"
  | "loading";

export interface Message {
  text: string;
  type: MessageType;
}

/* =========================================================
   SHIPPING
========================================================= */

export interface ShippingInfo {
  id: string;

  name: string;

  phone: string;

  address_line: string;

  region: string;

  district?: string;

  ward?: string;

  country: string;

  postal_code?: string | null;
}

/* =========================================================
   CHECKOUT ITEM
========================================================= */

export interface CheckoutItem {
  id: string;

  name: string;

  price: number;

  final_price: number;

  thumbnail?: string;

  stock: number;

  is_unlimited?: boolean;
}

/* =========================================================
   PRODUCT VARIANT
========================================================= */

export interface CheckoutVariant {
  id: string;

  price: number;

  sale_price?: number | null;

  final_price?: number;

  stock: number;
}

/* =========================================================
   PRODUCT
========================================================= */

export interface CheckoutProduct {
  id: string;

  name: string;

  thumbnail: string;

  price: number;

  sale_price?: number | null;

  final_price: number;

  stock: number;

  is_unlimited?: boolean;

  shipping_rates?: ShippingRate[];

  selectedVariant?: CheckoutVariant | null;

  variant_id?: string | null;
}

/* =========================================================
   COMPONENT
========================================================= */

export interface CheckoutProps {
  open: boolean;

  onClose: () => void;

  product: CheckoutProduct;
}

/* =========================================================
   VALIDATE
========================================================= */

export interface ValidateParams {
  user: unknown;

  piReady: boolean;

  shipping: ShippingInfo | null;

  item: CheckoutItem | null;

  quantity: number;

  maxStock: number;

  pilogin?: () => void;

  onLoginStarted?: () => void;

  onAddressRequired?: () => void;

  showMessage: (
    text: string,
    type?: MessageType
  ) => void;

  t: Record<string, string>;
}

/* =========================================================
   CHECKOUT PAY
========================================================= */

export interface UseCheckoutPayParams {
  item: CheckoutItem | null;

  quantity: number;

  total: number;

  shipping: ShippingInfo | null;

  unitPrice: number;

  processing: boolean;

  setProcessing: (
    value: boolean
  ) => void;

  processingRef: {
    current: boolean;
  };

  t: Record<string, string>;

  user: unknown;

  router: {
    push: (
      path: string
    ) => void;
  };

  onClose: () => void;

  product: CheckoutProduct;

  showMessage: (
    text: string,
    type?: MessageType
  ) => void;

  validate: () => boolean;
}
