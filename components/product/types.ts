export interface Category {
  id: string;
  key: string;
  icon?: string;
}
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
  zone: ShippingZone;
  price: number;

  domesticCountryCode?: string | null;
}

export type ShippingRatesState = {
  domestic: number | "";
  sea: number | "";
  asia: number | "";
  europe: number | "";
  north_america: number | "";
  rest_of_world: number | "";
};

/* =========================================================
   PRODUCT VARIANT
========================================================= */

export interface ProductVariant {
  id?: string;

  /* OPTIONS */
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;

  optionLabel1?: string | null;
  optionLabel2?: string | null;
  optionLabel3?: string | null;

  optionValue?: string;
  optionName?: string;
  name?: string;

  /* PRICE */
  salePrice?: number | string | null;
price?: number | string;
  finalPrice?: number;
  /* SALE */
  saleEnabled?: boolean;
  saleStock?: number;
  saleSold?: number;
  /* STOCK */
  stock: number;
  isUnlimited?: boolean;
  /* MEDIA */
  sku?: string | null;
  image?: string;
  /* STATUS */
  sortOrder?: number;
  isActive?: boolean;
  /* ANALYTICS */
  sold?: number;
}

/* =========================================================
   PRODUCT PAYLOAD
========================================================= */

export interface ProductPayload {
  id?: string;

  name: string;

  price: number;

  salePrice?: number | null;

  saleEnabled?: boolean;

  saleStock?: number;

  saleStart?: string | null;

  saleEnd?: string | null;

  description: string;

  detail: string;

  images: string[];

  thumbnail: string | null;

  categoryId: string;

  stock: number;

  isActive: boolean;

  variants?: ProductVariant[];

  shippingRates?: ShippingRate[];

  domesticCountryCode?: string | null;
}
