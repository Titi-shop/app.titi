/* =========================================================
   CATEGORY
========================================================= */

export interface Category {
  id: number;
  key: string;
  icon?: string | null;
}

/* =========================================================
   ENUMS
========================================================= */

export type CurrencyCode = "PI";

export type ProductStatus =
  | "draft"
  | "active"
  | "hidden"
  | "archived";

export type ShippingZone =
  | "domestic"
  | "sea"
  | "asia"
  | "europe"
  | "north_america"
  | "rest_of_world";

/* =========================================================
   SHIPPING
========================================================= */

export interface ShippingRate {
  id?: string;

  product_id?: string;

  zone_id?: string;

  zone?: ShippingZone;

  domestic_country_code?: string | null;

  price: number;

  currency?: CurrencyCode;

  created_at?: string;

  updated_at?: string;
}

export type ShippingRatesState =
  Record<
    ShippingZone,
    number | ""
  >;

/* =========================================================
   PRODUCT VARIANT
========================================================= */

export interface ProductVariant {
  id?: string;

  product_id?: string;

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

  currency?: CurrencyCode;

  /* SALE */
  sale_enabled?: boolean;

  sale_stock?: number;

  sale_sold?: number;

  /* STOCK */
  stock: number;

  is_unlimited?: boolean;

  sold?: number;

  /* MEDIA */
  image?: string;

  /* STATUS */
  is_active?: boolean;

  sort_order?: number;

  /* TIME */
  created_at?: string;

  updated_at?: string;

  deleted_at?: string | null;
}

/* =========================================================
   PRODUCT
========================================================= */

export interface ProductRecord {
  /* PRIMARY */
  id: string;

  seller_id: string;

  /* BASIC */
  name: string;

  slug: string;

  short_description: string;

  description: string;

  detail: string;

  /* MEDIA */
  thumbnail: string;

  images: string[];

  detail_images: string[];

  video_url: string;

  /* CATEGORY */
  category_id: number | null;

  /* TYPE */
  has_variants: boolean;

  is_digital: boolean;

  /* PRICE */
  price: number;

  sale_price: number | null;

  final_price: number;

  currency: CurrencyCode;

  /* SALE */
  sale_enabled: boolean;

  sale_stock: number;

  sale_sold: number;

  sale_start: string | null;

  sale_end: string | null;

  /* STOCK */
  stock: number;

  is_unlimited: boolean;

  sold: number;

  /* ANALYTICS */
  views: number;

  rating_avg: number;

  rating_count: number;

  /* SEO */
  meta_title: string;

  meta_description: string;

  /* STATUS */
  status: ProductStatus;

  is_active: boolean;

  is_featured: boolean;

  /* RELATIONS */
  variants?: ProductVariant[];

  shipping_rates?: ShippingRate[];

  /* TIME */
  created_at: string;

  updated_at: string;

  deleted_at?: string | null;
}

/* =========================================================
   FORM STATE
========================================================= */

export interface ProductFormState {
  id?: string;

  /* BASIC */
  name: string;
  slug?: string;
  short_description: string;
  description: string;
  detail: string;
  category_id: number | "" | null;

  /* MEDIA */
  thumbnail: string | null;
  images: string[];
  detail_images: string[];
  video_url: string;

  /* TYPE */
  has_variants: boolean;
  is_digital: boolean;

  /* PRICE */
  price: number | "";
  sale_price: number | "" | null;
  final_price?: number;
  currency: CurrencyCode;

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
  variants: ProductVariant[];

  /* SHIPPING */
  shipping_rates: ShippingRatesState;
  domestic_country_code: string | null;

  /* STATUS */
  status: ProductStatus;
  is_active: boolean;
  is_featured: boolean;

  /* SEO */
  meta_title: string;
  meta_description: string;
}

/* =========================================================
   PAYLOAD
========================================================= */

export interface ProductPayload {
  id?: string;
  name: string;
  slug?: string;
  short_description?: string;
  description: string;
  detail: string;
  category_id?: number | null;
  thumbnail?: string | null;
  images: string[];
  detail_images?: string[];
  video_url?: string;
  has_variants?: boolean;
  is_digital?: boolean;
  price?: number;
  sale_price?: number | null;
  final_price?: number;
  currency?: CurrencyCode;
  sale_enabled?: boolean;
  sale_stock?: number;
  sale_start?: string | null;
  sale_end?: string | null;
  stock?: number;
  is_unlimited?: boolean;
  sold?: number;
  variants?: ProductVariant[];
  shipping_rates?: ShippingRate[];
  domestic_country_code?: string | null;
  status?: ProductStatus;
  is_active?: boolean;
  is_featured?: boolean;
  meta_title?: string;
  meta_description?: string;
  idempotency_key?: string;
}
