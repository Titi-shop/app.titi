import { getProductById } from "@/lib/db/products";
import { getVariantById } from "@/lib/db/variants";
import {
  resolveShippingRateForBuyer,
} from "@/lib/db/shipping";
import { getAddressById } from "@/lib/db/addresses";

/* =========================================================
   TYPES
========================================================= */

export type PricingItemInput = {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
};

export type PricingInput = {
  user_id: string;
  address_id: string;
  items: PricingItemInput[];
};

export type PricingItemResult = {
  product_id: string;
  variant_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type PricingResult = {
  items: PricingItemResult[];
  subtotal: number;
  shipping_fee: number;
  total: number;
  buyer_country: string;
  buyer_zone: "resolved";
};

/* =========================================================
   HELPERS
========================================================= */

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]-[1-5][0-9a-f]-[89ab][0-9a-f]-[0-9a-f]{12}$/i.test(
    v
  );
}

function safeQty(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return 1;
  return Math.min(n, 100);
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isSaleActive(start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const now = Date.now();
  return now >= new Date(start).getTime() && now <= new Date(end).getTime();
}

/* =========================================================
   ADDRESS
========================================================= */

async function loadAddress(userId: string, addressId: string) {
  const address = await getAddressById(userId, addressId);

  if (!address) {
    throw new Error("ADDRESS_NOT_FOUND");
  }

  return {
    country: String(address.country).trim().toUpperCase(),
  };
}

/* =========================================================
   PRODUCT
========================================================= */

type Product = {
  id: string;
  name: string;
  price: number;
  sale_price: number | null;
  sale_start: string | null;
  sale_end: string | null;
  stock: number | null;
  is_unlimited: boolean;
  is_digital: boolean;
};

async function loadProduct(productId: string): Promise<Product> {
  const p = await getProductById(productId);

  if (!p) throw new Error("PRODUCT_NOT_FOUND");
  if (p.deleted_at) throw new Error("PRODUCT_DELETED");
  if (p.is_active === false) throw new Error("PRODUCT_INACTIVE");

  return {
    id: String(p.id),
    name: p.name,
    price: toNumber(p.price),
    sale_price: p.sale_price ? toNumber(p.sale_price) : null,
    sale_start: p.sale_start ?? null,
    sale_end: p.sale_end ?? null,
    stock: p.stock ?? null,
    is_unlimited: Boolean(p.is_unlimited),
    is_digital: Boolean(p.is_digital),
  };
}

/* =========================================================
   VARIANT
========================================================= */

type Variant = {
  id: string;
  price: number;
  sale_price: number | null;
  stock: number | null;
  is_unlimited: boolean;
};

async function loadVariant(
  variantId: string,
  productId: string
): Promise<Variant> {
  const v = await getVariantById(variantId);

  if (!v) throw new Error("VARIANT_NOT_FOUND");
  if (v.product_id !== productId) {
    throw new Error("VARIANT_PRODUCT_MISMATCH");
  }

  return {
    id: String(v.id),
    price: toNumber(v.price),
    sale_price: v.sale_price ? toNumber(v.sale_price) : null,
    stock: v.stock ?? null,
    is_unlimited: Boolean(v.is_unlimited),
  };
}

/* =========================================================
   MAIN ENGINE
========================================================= */

export async function calculatePricing(
  input: PricingInput
): Promise<PricingResult> {
  if (!input.items?.length) {
    throw new Error("INVALID_ITEMS");
  }

  /* ================= ADDRESS ================= */
  const address = await loadAddress(
    input.user_id,
    input.address_id
  );

  const buyerCountry = address.country;

  let subtotal = 0;
  let shippingFee = 0;

  const items: PricingItemResult[] = [];

  /* =====================================================
     LOOP ITEMS
  ===================================================== */

  for (const item of input.items) {
    if (!isUUID(item.product_id)) {
      throw new Error("INVALID_PRODUCT_ID");
    }

    const qty = safeQty(item.quantity);

    /* ================= PRODUCT ================= */
    const product = await loadProduct(item.product_id);

    let price = product.price;

    const saleActive = isSaleActive(
      product.sale_start,
      product.sale_end
    );

    if (
      saleActive &&
      product.sale_price &&
      product.sale_price < price
    ) {
      price = product.sale_price;
    }

    /* ================= STOCK CHECK ================= */
    if (
      !product.is_unlimited &&
      product.stock !== null &&
      product.stock < qty
    ) {
      throw new Error("OUT_OF_STOCK");
    }

    /* ================= VARIANT ================= */
    if (item.variant_id) {
      const variant = await loadVariant(
        item.variant_id,
        product.id
      );

      let vPrice = variant.price;

      if (
        saleActive &&
        variant.sale_price &&
        variant.sale_price < vPrice
      ) {
        vPrice = variant.sale_price;
      }

      if (
        !variant.is_unlimited &&
        variant.stock !== null &&
        variant.stock < qty
      ) {
        throw new Error("VARIANT_OUT_OF_STOCK");
      }

      price = vPrice;
    }

    const lineTotal = price * qty;
    subtotal += lineTotal;

    /* ================= SHIPPING (FIXED) ================= */
    if (!product.is_digital) {
      const shipping = await resolveShippingRateForBuyer({
        productId: product.id,
        buyerCountryCode: buyerCountry,
      });

      shippingFee += shipping.price;
    }

    items.push({
      product_id: product.id,
      variant_id: item.variant_id ?? null,
      name: product.name,
      quantity: qty,
      unit_price: price,
      subtotal: lineTotal,
    });
  }

  /* =====================================================
     RETURN RESULT
  ===================================================== */

  return {
    items,
    subtotal,
    shipping_fee: shippingFee,
    total: subtotal + shippingFee,
    buyer_country: buyerCountry,
    buyer_zone: "resolved",
  };
}

/* =========================================================
   EXPORT ALIAS
========================================================= */

export const buildPricingSnapshot = calculatePricing;
