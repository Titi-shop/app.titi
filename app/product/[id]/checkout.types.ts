import type { Product } from "@/types/Product";

/* =========================
   PI TYPE
========================= */

export type PiPayment = {
  createPayment: (
    data: {
      amount: number;
      memo: string;
      metadata: unknown;
    },
    callbacks: {
      onReadyForServerApproval: (
        paymentId: string,
        callback: () => void
      ) => void;
      onReadyForServerCompletion: (
        paymentId: string,
        txid: string
      ) => void;
      onCancel: () => void;
      onError: (error: unknown) => void;
    }
  ) => Promise<void>;
};

declare global {
  interface Window {
    Pi?: PiPayment;
  }
}

/* =========================
   REGION
========================= */

export type Region =
  | "domestic"
  | "sea"
  | "asia"
  | "europe"
  | "north_america"
  | "rest_of_world";

/* =========================
   SHIPPING
========================= */

export interface ShippingInfo {
  name: string;
  phone: string;
  address_line: string;
  region: string;
  district?: string;
  ward?: string;
  country: string;
  postal_code?: string | null;
}

/* =========================
   ADDRESS API
========================= */

export interface AddressApiItem {
  is_default: boolean;
  full_name: string;
  phone: string;
  address_line: string;
  region: string;
  district?: string;
  ward?: string;
  country: string;
  postal_code?: string | null;
}

export interface AddressApiResponse {
  items?: AddressApiItem[];
}

/* =========================
   MESSAGE
========================= */

export interface Message {
  text: string;
  type: "error" | "success";
}

/* =========================
   PREVIEW
========================= */

export interface PreviewItem {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

export interface PreviewPayload {
  country: string;
  zone: Region;

  shipping: {
    region: string;
    district?: string;
    ward?: string;
  };

  items: PreviewItem[];
}

export interface PreviewResponse {
  shipping_fee: number;
  total: number;
  currency?: string;
}

/* =========================
   CHECKOUT PRODUCT
========================= */

export interface CheckoutProduct extends Product {
  selectedVariant?: {
    id: string;
    price: number;
    salePrice?: number | null;
    finalPrice?: number;
    stock: number;
  } | null;

  variant_id?: string | null;
}

/* =========================
   COMPONENT PROPS
========================= */

export interface Props {
  open: boolean;
  onClose: () => void;
  product: CheckoutProduct;
}
/* =========================
   CHECKOUT LOGIC
========================= */

export type CheckoutItem = {
  id: string;
  name: string;
  thumbnail?: string;
  stock: number;
};

/* ========================= */

export interface ValidateParams {
  user: unknown;
  piReady: boolean;
  shipping: ShippingInfo | null;
  zone: Region | null;
  item: CheckoutItem | null;
  quantity: number;
  maxStock: number;

  pilogin?: () => void;

  showMessage: (
    text: string
  ) => void;

  t: Record<string, string>;
}

/* ========================= */

export interface UseCheckoutPayParams {
  item: CheckoutItem | null;

  quantity: number;

  total: number;

  shipping: ShippingInfo | null;

  unitPrice: number;

  processing: boolean;

  setProcessing: (
    v: boolean
  ) => void;

  processingRef: {
    current: boolean;
  };

  t: Record<string, string>;

  user: unknown;

  router: {
    push: (path: string) => void;
    replace: (path: string) => void;
  };

  onClose: () => void;

  zone: Region | null;

  product: {
    variant_id?: string | null;
  };

  showMessage: (
    text: string,
    type?: "error" | "success"
  ) => void;

  validate: () => boolean;

  preview: {
    total: number;
  } | null;
}
