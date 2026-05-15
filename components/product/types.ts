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
   SHIPPING
========================================================= */

export type ShippingZone =
  | "domestic"
  | "sea"
  | "asia"
  | "europe"
  | "north_america"
  | "rest_of_world";

export interface ShippingRate {
  id?: string;

  zone: ShippingZone;

  price: number;

  currency?: "PI";

  domesticCountryCode: string;
}

export type ShippingRatesState = Record<
  ShippingZone,
  number | ""
>;

/* =========================================================
   PRODUCT VARIANT
========================================================= */

export interface ProductVariant {
  id?: string;

  /* ================= OPTIONS ================= */

  option1: string;

  option2?: string | null;

  option3?: string | null;

  optionLabel1?: string | null;

  optionLabel2?: string | null;

  optionLabel3?: string | null;

  name?: string;

  /* ================= SKU ================= */

  sku?: string | null;

  /* ================= PRICE ================= */

  price: number;

  salePrice?: number | null;

  finalPrice?: number;

  currency?: "PI";

  /* ================= FLASH SALE ================= */

  saleEnabled?: boolean;

  saleStock?: number;

  saleSold?: number;

  /* ================= STOCK ================= */

  stock: number;

  isUnlimited?: boolean;

  /* ================= MEDIA ================= */

  image?: string;

  /* ================= STATUS ================= */

  isActive?: boolean;

  sortOrder?: number;

  /* ================= ANALYTICS ================= */

  sold?: number;
}

/* =========================================================
   PRODUCT FORM STATE
========================================================= */

export interface ProductFormState {
  id?: string;

  /* ================= BASIC ================= */

  name: string;

  slug?: string;

  shortDescription: string;

  description: string;

  detail: string;

  categoryId: number | null;

  /* ================= MEDIA ================= */

  thumbnail: string | null;

  images: string[];

  detailImages: string[];

  videoUrl: string;

  /* ================= PRICE ================= */

  price: number | "";

  salePrice: number | "" | null;

  finalPrice?: number;

  currency: "PI";

  /* ================= FLASH SALE ================= */

  saleEnabled: boolean;

  saleStock: number | "";

  saleSold?: number;

  saleStart: string | null;

  saleEnd: string | null;

  /* ================= STOCK ================= */

  stock: number | "";

  isUnlimited: boolean;

  /* ================= PRODUCT TYPE ================= */

  hasVariants: boolean;

  variants: ProductVariant[];

  /* ================= SHIPPING ================= */

  shippingRates: ShippingRatesState;

  domesticCountryCode: string | null;

  /* ================= STATUS ================= */

  status: ProductStatus;

  isActive: boolean;

  isFeatured: boolean;

  isDigital: boolean;

  /* ================= SEO ================= */

  metaTitle: string;

  metaDescription: string;
}

/* =========================================================
   API PAYLOAD
========================================================= */

export interface ProductPayload {
  id?: string;

  /* ================= BASIC ================= */

  name: string;

  shortDescription: string;

  description: string;

  detail: string;

  categoryId: number | null;

  /* ================= MEDIA ================= */

  thumbnail: string | null;

  images: string[];

  detailImages: string[];

  videoUrl?: string;

  /* ================= PRICE ================= */

  price: number;

  salePrice: number | null;

  currency?: "PI";

  /* ================= FLASH SALE ================= */

  saleEnabled: boolean;

  saleStock: number;

  saleStart: string | null;

  saleEnd: string | null;

  /* ================= STOCK ================= */

  stock: number;

  isUnlimited: boolean;

  /* ================= VARIANTS ================= */

  hasVariants: boolean;

  variants: ProductVariant[];

  /* ================= SHIPPING ================= */

  shippingRates: ShippingRate[];

  domesticCountryCode?: string | null;

  /* ================= STATUS ================= */

  status?: ProductStatus;

  isActive: boolean;

  isFeatured?: boolean;

  isDigital?: boolean;

  /* ================= SEO ================= */

  metaTitle?: string;

  metaDescription?: string;

  /* ================= REQUEST ================= */

  idempotencyKey?: string;
}

/* =========================================================
   PRODUCT RESPONSE
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
}
