export interface Category {
  id: string;
  key: string;
  icon?: string;
}

export interface ProductVariant {
  id?: string;

  option1?: string; // Red / 10ml
  option2?: string; // XL
  option3?: string;
  optionLabel1?: string; // Color / Volume
  optionLabel2?: string; // Size
  optionLabel3?: string;
  price?: number | null;
  salePrice?: number | null;
  stock: number;
  sku?: string | null;
  image?: string;
  isActive?: boolean;
}

/* =========================
   PRODUCT PAYLOAD (CLIENT)
========================= */
export interface ProductPayload {
  id?: string;

  name: string;
  price: number;

  /* 🔥 SALE */
  salePrice?: number | null;
  saleStart?: string | null;
  saleEnd?: string | null;

  description: string;
  detail: string;

  images: string[];
  thumbnail: string | null;

  categoryId: string;

  stock: number;

  /* 🔥 FIX */
  isActive: boolean;

  variants?: ProductVariant[];

  /* 🔥 FIX naming */
  shippingRates?: {
    zone: string;
    price: number;
  }[];
}
