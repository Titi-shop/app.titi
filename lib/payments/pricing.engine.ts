import { getProductById } from "@/lib/db/products";
import { getVariantById } from "@/lib/db/variants";
import { getShippingRatesByProduct, getZoneByCountry } from "@/lib/db/shipping";
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

export type PricingResult = {
  items: any[];
  subtotal: number;
  shipping_fee: number;
  total: number;
  buyer_country: string;
  buyer_zone: string;
};

/* =========================================================
   HELPERS
========================================================= */

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function safeQty(n: unknown) {
  const q = Number(n);
  if (!Number.isInteger(q) || q <= 0) return 1;
  return Math.min(q, 100);
}

function safeNumber(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function isSaleActive(start: string | null, end: string | null) {
  if (!start || !end) return false;
  const now = Date.now();
  return now >= new Date(start).getTime() && now <= new Date(end).getTime();
}

/* =========================================================
   LOAD ADDRESS (FIXED ROOT BUG)
========================================================= */

async function loadAddress(userId: string, addressId: string) {
  const address = await getAddressById(userId, addressId);

  if (!address) throw new Error("ADDRESS_NOT_FOUND");

  return {
    country: String(address.country).trim().toUpperCase(),
  };
}

/* =========================================================
   PRODUCT
========================================================= */

async function loadProduct(productId: string) {
  const p = await getProductById(productId);

  if (!p) throw new Error("PRODUCT_NOT_FOUND");

  if (p.deleted_at) throw new Error("PRODUCT_DELETED");
  if (p.is_active === false) throw new Error("PRODUCT_INACTIVE");

  return {
    id: String(p.id),
    name: p.name,
    price: safeNumber(p.price),
    sale_price: p.sale_price ? safeNumber(p.sale_price) : null,
    sale_start: p.sale_start ?? null,
    sale_end: p.sale_end ?? null,
    stock: p.stock ?? null,
    is_unlimited: !!p.is_unlimited,
    is_digital: !!p.is_digital,
    seller_country: p.domestic_country_code ?? null,
  };
}

/* =========================================================
   VARIANT
========================================================= */

async function loadVariant(variantId: string, productId: string) {
  const v = await getVariantById(variantId);

  if (!v) throw new Error("VARIANT_NOT_FOUND");
  if (v.product_id !== productId) throw new Error("VARIANT_PRODUCT_MISMATCH");

  return {
    id: String(v.id),
    price: safeNumber(v.price),
    sale_price: v.sale_price ? safeNumber(v.sale_price) : null,
    stock: v.stock ?? null,
    is_unlimited: !!v.is_unlimited,
  };
}

/* =========================================================
   SHIPPING
========================================================= */

async function getShipping(
  productId: string,
  country: string,
  zone: string
) {
  const rates =
    await getShippingRatesByProduct(
      productId
    );

  if (!rates.length) {
    throw new Error(
      "SHIPPING_NOT_AVAILABLE"
    );
  }

  const buyerCountry =
    country.toUpperCase();

  const domesticRate = rates.find(
    (r) => r.zone === "domestic"
  );

  /* ==========================
     DOMESTIC COUNTRY CHECK
  ========================== */

  if (
    domesticRate?.domestic_country_code &&
    domesticRate.domestic_country_code.toUpperCase() !==
      buyerCountry
  ) {
    throw new Error(
      "COUNTRY_NOT_SUPPORTED_FOR_DOMESTIC"
    );
  }

  if (
    domesticRate &&
    domesticRate.domestic_country_code?.toUpperCase() ===
      buyerCountry
  ) {
    return safeNumber(
      domesticRate.price
    );
  }

  const regional = rates.find(
    (r) => r.zone === zone
  );

  if (regional) {
    return safeNumber(
      regional.price
    );
  }

  const global = rates.find(
    (r) =>
      r.zone === "rest_of_world"
  );

  if (global) {
    return safeNumber(
      global.price
    );
  }

  throw new Error(
    "SHIPPING_NOT_AVAILABLE"
  );
}
/* =========================================================
   MAIN ENGINE
========================================================= */

export async function calculatePricing(input: PricingInput): Promise<PricingResult> {
  if (!input.items?.length) throw new Error("INVALID_ITEMS");

  /* ===== ADDRESS ===== */
  const address = await loadAddress(input.user_id, input.address_id);
  const buyerCountry = address.country;

  const buyerZone = (await getZoneByCountry(buyerCountry)) ?? "rest_of_world";

  let subtotal = 0;
  let shipping = 0;

  const items = [];

  for (const item of input.items) {
    if (!isUUID(item.product_id)) throw new Error("INVALID_PRODUCT_ID");

    const qty = safeQty(item.quantity);

    /* ===== PRODUCT ===== */
    const product = await loadProduct(item.product_id);

    /* ===== COUNTRY RULE (FIXED POSITION) ===== */
    if (product.seller_country) {
      const sellerCountry = product.seller_country.toUpperCase();
      if (sellerCountry !== buyerCountry) {
        throw new Error("COUNTRY_NOT_SUPPORTED_FOR_DOMESTIC");
      }
    }

    let price = product.price;

    const saleActive = isSaleActive(product.sale_start, product.sale_end);
    if (saleActive && product.sale_price && product.sale_price < price) {
      price = product.sale_price;
    }

    /* ===== STOCK CHECK ===== */
    if (!product.is_unlimited && product.stock !== null && product.stock < qty) {
      throw new Error("OUT_OF_STOCK");
    }

    /* ===== VARIANT ===== */
    if (item.variant_id) {
      const variant = await loadVariant(item.variant_id, product.id);

      let vPrice = variant.price;

      if (saleActive && variant.sale_price && variant.sale_price < vPrice) {
        vPrice = variant.sale_price;
      }

      if (!variant.is_unlimited && variant.stock !== null && variant.stock < qty) {
        throw new Error("VARIANT_OUT_OF_STOCK");
      }

      price = vPrice;
    }

    const line = price * qty;
    subtotal += line;

    if (!product.is_digital) {
      shipping += await getShipping(product.id, buyerCountry, buyerZone);
    }

    items.push({
      product_id: product.id,
      variant_id: item.variant_id ?? null,
      name: product.name,
      quantity: qty,
      unit_price: price,
      subtotal: line,
    });
  }

  return {
    items,
    subtotal,
    shipping_fee: shipping,
    total: subtotal + shipping,
    buyer_country: buyerCountry,
    buyer_zone: buyerZone,
  };
}

/* =========================================================
   EXPORT
========================================================= */

export const buildPricingSnapshot = calculatePricing;
