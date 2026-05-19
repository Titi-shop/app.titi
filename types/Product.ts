/* =========================================================
   CATEGORY
========================================================= */

export interface Category {
  id: number;
  key: string;
  icon?: string | null;
}

/* =========================================================
   PRODUCT STATUS
========================================================= */

export type ProductStatus =
  | "draft"
  | "active"
  | "inactive"
  | "archived"
  | "banned";

/* =========================================================
   SHIPPING ZONE
========================================================= */

export type ShippingZone =
  | "domestic"
  | "sea"
  | "asia"
  | "europe"
  | "north_america"
  | "rest_of_world";

/* =========================================================
   SHIPPING RATE
========================================================= */

export interface ShippingRate {
  id?: string;

  zone: ShippingZone;

  price: number;

  currency?: "PI";

  domestic_country_code?: string | null;
}

/* =========================================================
   SHIPPING FORM STATE
========================================================= */

export type ShippingRatesState = Record<
  ShippingZone,
  number | ""
>;

/* =========================================================
   PRODUCT VARIANT
========================================================= */

export interface ProductVariant {
  id?: string;

  /* OPTIONS */
  option1: string;
  option2?: string | null;
  option3?: string | null;

  option_label1?: string | null;
  option_label2?: string | null;
  option_label3?: string | null;

  name?: string;

  /* SKU */
  sku?: string | null;

  /* PRICE */
  price: number;

  sale_price?: number | null;

  final_price?: number;

  currency?: "PI";

  /* SALE */
  sale_enabled?: boolean;

  sale_stock?: number;

  sale_sold?: number;

  /* STOCK */
  stock: number;

  is_unlimited?: boolean;

  /* MEDIA */
  image?: string;

  /* STATUS */
  is_active?: boolean;

  sort_order?: number;

  /* ANALYTICS */
  sold?: number;
}

/* =========================================================
   PRODUCT FORM STATE
========================================================= */

export interface ProductFormState {
  id?: string;

  /* BASIC */
  name: string;

  slug?: string;

  short_description: string;

  description: string;

  detail: string;

  category_id: string | number | null;

  /* MEDIA */
  thumbnail: string | null;

  images: string[];

  detail_images: string[];

  video_url: string;

  /* PRICE */
  price: number | "";

  sale_price: number | "" | null;

  final_price?: number;

  currency: "PI";

  /* SALE */
  sale_enabled: boolean;

  sale_stock: number | "";

  sale_sold?: number;

  sale_start: string | null;

  sale_end: string | null;

  /* STOCK */
  stock: number | "";

  is_unlimited: boolean;

  /* VARIANTS */
  has_variants: boolean;

  variants: ProductVariant[];

  /* SHIPPING */
  shipping_rates: ShippingRatesState;

  domestic_country_code: string | null;

  /* STATUS */
  status: ProductStatus;

  is_active: boolean;

  is_featured: boolean;

  is_digital: boolean;

  /* SEO */
  meta_title: string;

  meta_description: string;
}

/* =========================================================
   PRODUCT PAYLOAD
========================================================= */

export interface ProductPayload {
  id?: string;
  name: string;
  short_description?: string;
  description: string;
  detail: string;
  category_id?: string | number | null;
  thumbnail?: string | null;
  images: string[];
  detail_images?: string[];
  video_url?: string;
  price?: number;
  sale_price?: number | null;
  currency?: "PI";
  sale_enabled?: boolean;
  sale_stock?: number;
  sale_start?: string | null;
  sale_end?: string | null;
  stock?: number;
  is_unlimited?: boolean;
  has_variants?: boolean;
  variants?: ProductVariant[];
  shipping_rates?: ShippingRate[];
  domestic_country_code?: string | null;
  status?: ProductStatus;
  is_active?: boolean;
  is_featured?: boolean;
  is_digital?: boolean;
  meta_title?: string;
  meta_description?: string;
  idempotency_key?: string;
}
/* =========================================================
   PRODUCT RECORD
========================================================= */

export interface ProductRecord {
  id: string;
  seller_id: string;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  detail: string;
  thumbnail: string | null;
  images: string[];
  detail_images: string[];
  video_url: string;
  price: number;
  sale_price: number | null;
  final_price: number;
  currency: "PI";
  stock: number;
  is_unlimited: boolean;
  sold: number;
  views: number;
  rating_avg: number;
  rating_count: number;
  status: ProductStatus;
  is_active: boolean;
  is_featured: boolean;
  is_digital: boolean;
  category_id: number | null;
  sale_enabled: boolean;
  sale_stock: number;
  sale_sold: number;
  sale_start: string | null;
  sale_end: string | null;
  has_variants: boolean;
  variants?: ProductVariant[];
  meta_title: string;
  meta_description: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}
