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
   SHIPPING RATE (DB / API LAYER)
========================================================= */

export interface ShippingRate {
  id?: string;

  zone: ShippingZone;

  price: number;

  currency?: "PI";

  // DB field (snake_case source)
  domestic_country_code?: string | null;
}

/* =========================================================
   SHIPPING FORM STATE (UI LAYER)
========================================================= */

export type ShippingRatesState = Record<
  ShippingZone,
  number | ""
>;

/* =========================================================
   PRODUCT VARIANT (UI + API HYBRID)
========================================================= */

export interface ProductVariant {
  id?: string;

  /* OPTIONS */
  option1: string;
  option2?: string | null;
  option3?: string | null;

  optionLabel1?: string | null;
  optionLabel2?: string | null;
  optionLabel3?: string | null;

  name?: string;

  /* SKU */
  sku?: string | null;

  /* PRICE */
  price: number;
  salePrice?: number | null;
  finalPrice?: number;
  currency?: "PI";

  /* SALE */
  saleEnabled?: boolean;
  saleStock?: number;
  saleSold?: number;

  /* STOCK */
  stock: number;
  isUnlimited?: boolean;

  /* MEDIA */
  image?: string;

  /* STATUS */
  isActive?: boolean;
  sortOrder?: number;

  /* ANALYTICS */
  sold?: number;
}

/* =========================================================
   PRODUCT FORM STATE (UI LAYER - CAMELCASE ONLY)
========================================================= */

export interface ProductFormState {
  id?: string;

  /* BASIC */
  name: string;
  slug?: string;

  shortDescription: string;
  description: string;
  detail: string;

  categoryId: string | number | null;

  /* MEDIA */
  thumbnail: string | null;
  images: string[];
  detailImages: string[];
  videoUrl: string;

  /* PRICE */
  price: number | "";
  salePrice: number | "" | null;
  finalPrice?: number;

  currency: "PI";

  /* SALE */
  saleEnabled: boolean;
  saleStock: number | "";
  saleSold?: number;

  saleStart: string | null;
  saleEnd: string | null;

  /* STOCK */
  stock: number | "";

  isUnlimited: boolean;

  /* VARIANTS */
  hasVariants: boolean;
  variants: ProductVariant[];

  /* SHIPPING */
  shippingRates: ShippingRatesState;

  domesticCountryCode: string | null;

  /* STATUS */
  status: ProductStatus;

  isActive: boolean;
  isFeatured: boolean;
  isDigital: boolean;

  /* SEO */
  metaTitle: string;
  metaDescription: string;
}

/* =========================================================
   PRODUCT PAYLOAD (API LAYER - SEND TO BACKEND)
========================================================= */

export interface ProductPayload {
  id?: string;

  /* BASIC */
  name: string;
  shortDescription: string;
  description: string;
  detail: string;

  categoryId: string | number | null;

  /* MEDIA */
  thumbnail: string | null;
  images: string[];
  detailImages: string[];
  videoUrl?: string;

  /* PRICE */
  price: number;
  salePrice: number | null;
  currency?: "PI";

  /* SALE */
  saleEnabled: boolean;
  saleStock: number;
  saleStart: string | null;
  saleEnd: string | null;

  /* STOCK */
  stock: number;
  isUnlimited: boolean;

  /* VARIANTS */
  hasVariants: boolean;
  variants: ProductVariant[];

  /* SHIPPING */
  shippingRates: ShippingRate[];
  domesticCountryCode?: string | null;

  /* STATUS */
  status?: ProductStatus;

  isActive: boolean;
  isFeatured?: boolean;
  isDigital?: boolean;

  /* SEO */
  metaTitle?: string;
  metaDescription?: string;

  /* REQUEST */
  idempotencyKey?: string;
}

/* =========================================================
   PRODUCT RESPONSE (FROM SERVER)
========================================================= */

export interface ProductRecord {
  id: string;

  sellerId: string;

  name: string;
  slug: string;

  shortDescription: string;
  description: string;
  detail: string;

  thumbnail: string | null;
  images: string[];
  detailImages: string[];
  videoUrl: string;

  price: number;
  salePrice: number | null;
  finalPrice: number;

  currency: "PI";

  stock: number;
  isUnlimited: boolean;

  sold: number;
  views: number;

  ratingAvg: number;
  ratingCount: number;

  status: ProductStatus;

  isActive: boolean;
  isFeatured: boolean;
  isDigital: boolean;

  categoryId: number | null;

  saleEnabled: boolean;
  saleStock: number;
  saleSold: number;

  saleStart: string | null;
  saleEnd: string | null;

  hasVariants: boolean;

  variants?: ProductVariant[];

  metaTitle: string;
  metaDescription: string;

  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;

  /* ========================
     RAW DB SUPPORT (FIX BUG EDIT)
  ======================== */

  // giúp tránh lỗi snake_case mismatch
  is_active?: boolean;
  sale_enabled?: boolean;
  sale_price?: number;
  sale_start?: string;
  sale_end?: string;
}
