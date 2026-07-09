import { getProductById } from "@/lib/db/products";
import { getVariantById } from "@/lib/db/variants";
import {
  getShippingRatesByProduct,
  getZoneByCountry,
} from "@/lib/db/shipping";
import { getAddressById } from "@/lib/db/addresses";
import {
  logger,
  maskId,
} from "@/lib/logger";
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

type ShippingZone =
  | "domestic"
  | "sea"
  | "asia"
  | "europe"
  | "north_america"
  | "rest_of_world";

type ShippingRate = {
  zone: ShippingZone;
  price: number;
  domestic_country_code: string | null;
};

export type PricingResult = {
  items: {
    product_id: string;
    variant_id: string | null;
    name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
  subtotal: number;
  shipping_fee: number;
  total: number;
  buyer_country: string;
  buyer_zone: string;
  shipping_zone: string;
};

/* =========================================================
   HELPERS
========================================================= */

function isUUID(v: unknown): v is string {
  if (typeof v !== "string") return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim()
  );
}

function safeQty(n: unknown): number {
  const q = Number(n);

  if (!Number.isInteger(q)) {
    throw new Error("INVALID_QUANTITY");
  }
  if (q <= 0) {
    throw new Error("INVALID_QUANTITY");
  }
  if (q > 100) {
    throw new Error("INVALID_QUANTITY");
  }
  return q;
}

function safeNumber(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
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
  logger.info(
  "PRICING.ADDRESS_LOAD",
  {
    userId: maskId(userId),
    addressId: maskId(addressId),
  }
);

  const address = await getAddressById(userId, addressId);

  if (!address) {
    logger.warn(
  "PRICING.ADDRESS_NOT_FOUND"
);
    throw new Error("ADDRESS_NOT_FOUND");
  }

  const country = String(address.country).trim().toUpperCase();

  logger.info(
  "PRICING.ADDRESS_OK",
  {
    country,
  }
);

  return { country };
}

/* =========================================================
   PRODUCT
========================================================= */

async function loadProduct(productId: string) {
  logger.debug(
  "PRICING.PRODUCT_LOAD",
  {
    productId: maskId(productId),
  }
);

  const p = await getProductById(productId);

  if (!p) throw new Error("PRODUCT_NOT_FOUND");
  if (p.deleted_at) throw new Error("PRODUCT_DELETED");
  if (p.is_active === false) throw new Error("PRODUCT_INACTIVE");

  const product = {
  id: String(p.id),
  name: p.name,

  price:
  p.price !== null
    ? safeNumber(p.price)
    : null,

  sale_price:
    p.sale_price !== null
      ? safeNumber(p.sale_price)
      : null,

  final_price:
  p.final_price !== null
    ? safeNumber(p.final_price)
    : null,

  sale_start: p.sale_start ?? null,
  sale_end: p.sale_end ?? null,

  stock: p.stock ?? null,

  is_unlimited: !!p.is_unlimited,
  is_digital: !!p.is_digital,

  seller_country:
    p.domestic_country_code ?? null,
};

if (
  !p.has_variants &&
  (
    !Number.isFinite(product.final_price) ||
    product.final_price <= 0
  )
) {
  throw new Error(
    "PRODUCT_PRICE_CORRUPTED"
  );
}

  logger.debug(
  "PRICING.PRODUCT_OK",
  {
    productId: maskId(product.id),
  }
);

  return product;
}

/* =========================================================
   VARIANT
========================================================= */

async function loadVariant(variantId: string, productId: string) {
  logger.debug(
  "PRICING.VARIANT_LOAD",
  {
    variantId: maskId(variantId),
  }
);

  const v = await getVariantById(variantId);

  if (!v) throw new Error("VARIANT_NOT_FOUND");
  if (v.product_id !== productId) throw new Error("VARIANT_PRODUCT_MISMATCH");

  const variant = {
  id: String(v.id),
  price: safeNumber(v.price),
  sale_price:
    v.sale_price !== null
      ? safeNumber(v.sale_price)
      : null,

  final_price: safeNumber(
    v.final_price
  ),

  stock: v.stock ?? null,

  is_unlimited:
    !!v.is_unlimited,
};

if (
  !Number.isFinite(
    variant.final_price
  ) ||
  variant.final_price <= 0
) {
  throw new Error(
    "VARIANT_PRICE_CORRUPTED"
  );
}

  logger.debug(
  "PRICING.VARIANT_OK",
  {
    variantId: maskId(variant.id),
  }
);

  return variant;
}

/* =========================================================
   SHIPPING
========================================================= */

async function getShipping(
  productId: string,
  buyerCountry: string,
  buyerZone: string
): Promise<{
  price: number;
  zone: ShippingZone;
}> {
  const rates = await getShippingRatesByProduct(productId);

  if (!rates.length) {
    throw new Error("SHIPPING_NOT_AVAILABLE");
  }

  const country = buyerCountry.toUpperCase();
  /* =========================
     DOMESTIC FIRST
  ========================= */

  const domestic = rates.find(
    (r) =>
      r.zone === "domestic" &&
      r.domestic_country_code?.toUpperCase() === country
  );

  if (domestic) {
    return {
      price: Number(domestic.price),
      zone: "domestic",
    };
  }

  /* =========================
     REGION MATCH
  ========================= */
  const zoneRate = rates.find(
    (r) => r.zone === buyerZone
  );

  if (zoneRate) {
    return {
      price: Number(zoneRate.price),
      zone: zoneRate.zone,
    };
  }

  /* =========================
     FALLBACK
  ========================= */
  const global = rates.find(
    (r) => r.zone === "rest_of_world"
  );

  if (global) {
    return {
      price: Number(global.price),
      zone: "rest_of_world",
    };
  }

  throw new Error("SHIPPING_NOT_AVAILABLE");
}

/* =========================================================
   MAIN ENGINE
========================================================= */

export async function calculatePricing(
  input: PricingInput
): Promise<PricingResult> {
  try {
  logger.info(
  "PRICING.START",
  {
    userId: maskId(input.user_id),
    addressId: maskId(input.address_id),
    itemCount: input.items.length,
  }
);

  if (!input.items?.length) throw new Error("INVALID_ITEMS");
const duplicateCheck = new Set<string>();

for (const item of input.items) {
  const key =
    `${item.product_id}:${item.variant_id ?? ""}`;

  if (duplicateCheck.has(key)) {
    throw new Error("DUPLICATE_ITEM");
  }

  duplicateCheck.add(key);
}
  const address = await loadAddress(input.user_id, input.address_id);
  const buyerCountry = address.country;

  const buyerZone =
    (await getZoneByCountry(buyerCountry)) ?? "rest_of_world";

  logger.info(
  "PRICING.BUYER_CONTEXT",
  {
    buyerCountry,
    buyerZone,
  }
);

  let subtotal = 0;
  let shipping = 0;
  let shippingZone: ShippingZone | null = null;
  const items: PricingResult["items"] = [];

  for (const item of input.items) {
    logger.debug(
  "PRICING.ITEM_START",
  {
    quantity: item.quantity,
    hasVariant:
      item.variant_id !== null,
  }
);

    if (!isUUID(item.product_id)) {
      logger.warn(
  "PRICING.INVALID_PRODUCT_ID"
);
      throw new Error("INVALID_PRODUCT_ID");
    }

    const qty = safeQty(item.quantity);
    const product = await loadProduct(item.product_id);
    if (product.seller_country) {
      const sellerCountry = product.seller_country.toUpperCase();
      if (sellerCountry !== buyerCountry) {
        throw new Error("COUNTRY_NOT_SUPPORTED_FOR_DOMESTIC");
      }
    }

   let price = product.final_price;
if (
  item.variant_id !== null &&
  item.variant_id !== undefined &&
  !isUUID(item.variant_id)
) {
  throw new Error("INVALID_VARIANT_ID");
}
if (item.variant_id) {
  const variant = await loadVariant(
    item.variant_id,
    product.id
  );

  const vPrice =
    variant.final_price;

  if (
    !Number.isFinite(vPrice) ||
    vPrice <= 0
  ) {
    throw new Error(
      "INVALID_VARIANT_PRICE"
    );
  }

  if (
    !variant.is_unlimited &&
    variant.stock !== null &&
    variant.stock < qty
  ) {
    throw new Error(
      "VARIANT_OUT_OF_STOCK"
    );
  }

  price = vPrice;
} else {
  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {
    throw new Error(
      "INVALID_PRODUCT_PRICE"
    );
  }

  if (
    !product.is_unlimited &&
    product.stock !== null &&
    product.stock < qty
  ) {
    throw new Error(
      "OUT_OF_STOCK"
    );
  }
}

const line = price * qty;
    subtotal += line;

    if (!product.is_digital) {
  const ship = await getShipping(
    product.id,
    buyerCountry,
    buyerZone
  );

  shipping += ship.price;
  shippingZone = ship.zone;
}

    const resultItem = {
      product_id: product.id,
      variant_id: item.variant_id ?? null,
      name: product.name,
      quantity: qty,
      unit_price: price,
      subtotal: line,
    };

    items.push(resultItem);

    logger.debug(
  "PRICING.ITEM_DONE",
  {
    quantity: qty,
    subtotal: line,
  }
);
  }
const result: PricingResult = {
  items,
  subtotal,
  shipping_fee: shipping,
  total: subtotal + shipping,
  buyer_country: buyerCountry,
  buyer_zone: buyerZone,
  shipping_zone: shippingZone,
};

  logger.info(
  "PRICING.DONE",
  {
    subtotal,
    shipping,
    total: subtotal + shipping,
  }
);
     return result;
  } catch (error) {
     logger.error(
       "PRICING.ERROR",
       {
         message:
           error instanceof Error
             ? error.message
             : "UNKNOWN_ERROR",
       }
     );
     throw error;
  }
}
/* =========================================================
   EXPORT
========================================================= */

export const buildPricingSnapshot = calculatePricing;
