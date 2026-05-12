import {
  getProductById,
} from "@/lib/db/products";

import {
  getVariantById,
} from "@/lib/db/variants";

import {
  getShippingRatesByProduct,
  getZoneByCountry,
} from "@/lib/db/shipping";

/* =========================================================
   TYPES
========================================================= */

export type PricingItemInput = {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
};

export type PricingInput = {
  items: PricingItemInput[];

  country: string;

  zone?: string | null;
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

  buyer_zone: string;

  snapshots: {
    products: Record<string, unknown>[];

    variants: Record<string, unknown>[];
  };
};

/* =========================================================
   INTERNAL TYPES
========================================================= */

type ProductRow = {
  id: string;

  name: string;

  price: number;

  sale_price: number | null;

  sale_start: string | null;

  sale_end: string | null;

  stock?: number | null;

  is_active?: boolean | null;

  deleted_at?: string | null;

  is_unlimited?: boolean | null;

  is_digital?: boolean | null;

  seller_id?: string | null;

  sale_enabled?: boolean | null;
};

type VariantRow = {
  id: string;

  product_id: string;

  price: number;

  sale_price: number | null;

  stock?: number | null;

  is_active?: boolean | null;

  is_unlimited?: boolean | null;
};

/* =========================================================
   HELPERS
========================================================= */

function vlog(step: string, data?: unknown) {
  console.log(`[PRICING_ENGINE_V7][${step}]`, data ?? "");
}

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

function safeNumber(v: unknown, fallback = 0): number {
  const n = Number(v);

  if (!Number.isFinite(n)) {
    return fallback;
  }

  return n;
}

function safeQty(v: unknown): number {
  const n = Number(v);

  if (!Number.isInteger(n) || n <= 0) {
    return 1;
  }

  return Math.min(n, 100);
}

function isSaleWindow(
  start: string | null,
  end: string | null
): boolean {
  if (!start || !end) {
    return false;
  }

  const now = Date.now();

  const s = new Date(start).getTime();

  const e = new Date(end).getTime();

  return now >= s && now <= e;
}

function resolveProductPrice(
  product: ProductRow
): number {
  const base = safeNumber(product.price);

  const sale = safeNumber(
    product.sale_price,
    0
  );

  const active =
    Boolean(product.sale_enabled) &&
    isSaleWindow(
      product.sale_start,
      product.sale_end
    );

  if (
    active &&
    sale > 0 &&
    sale < base
  ) {
    return sale;
  }

  return base;
}

function resolveVariantPrice(
  product: ProductRow,
  variant: VariantRow
): number {
  const base = safeNumber(variant.price);

  const sale = safeNumber(
    variant.sale_price,
    0
  );

  const active =
    isSaleWindow(
      product.sale_start,
      product.sale_end
    );

  if (
    active &&
    sale > 0 &&
    sale < base
  ) {
    return sale;
  }

  return base;
}

/* =========================================================
   SHIPPING
========================================================= */

async function calculateShippingFee(params: {
  productId: string;

  buyerCountry: string;

  buyerZone: string;
}): Promise<number> {
  const {
    productId,
    buyerCountry,
    buyerZone,
  } = params;

  const rates =
    await getShippingRatesByProduct(
      productId
    );

  const domestic = rates.find(
    (r) =>
      r.zone === "domestic" &&
      (
        r.domesticCountryCode ?? ""
      ).toUpperCase() === buyerCountry
  );

  if (domestic) {
    return safeNumber(domestic.price);
  }

  const regional = rates.find(
    (r) => r.zone === buyerZone
  );

  if (regional) {
    return safeNumber(regional.price);
  }

  const global = rates.find(
    (r) =>
      r.zone === "rest_of_world"
  );

  if (global) {
    return safeNumber(global.price);
  }

  throw new Error(
    "SHIPPING_NOT_AVAILABLE"
  );
}

/* =========================================================
   VALIDATE PRODUCT
========================================================= */

async function loadProduct(
  productId: string
): Promise<ProductRow> {
  const product =
    await getProductById(productId);

  if (!product) {
    throw new Error(
      "PRODUCT_NOT_FOUND"
    );
  }

  const normalized: ProductRow = {
    id: String(product.id),

    name: String(product.name),

    price: safeNumber(product.price),

    sale_price:
      product.sale_price !== null
        ? safeNumber(
            product.sale_price
          )
        : null,

    sale_start:
      product.sale_start !== null
        ? String(product.sale_start)
        : null,

    sale_end:
      product.sale_end !== null
        ? String(product.sale_end)
        : null,

    stock:
      typeof product.stock ===
      "number"
        ? product.stock
        : null,

    is_active:
      product.is_active !== false,

    deleted_at:
      product.deleted_at ?? null,

    is_unlimited:
      Boolean(
        product.is_unlimited
      ),

    is_digital:
      Boolean(product.is_digital),

    seller_id:
      product.seller_id ?? null,

    sale_enabled:
      Boolean(
        product.sale_enabled
      ),
  };

  if (
    normalized.is_active === false
  ) {
    throw new Error(
      "PRODUCT_INACTIVE"
    );
  }

  if (normalized.deleted_at) {
    throw new Error(
      "PRODUCT_DELETED"
    );
  }

  return normalized;
}

/* =========================================================
   VALIDATE VARIANT
========================================================= */

async function loadVariant(
  variantId: string,
  productId: string
): Promise<VariantRow> {
  const variant =
    await getVariantById(variantId);

  if (!variant) {
    throw new Error(
      "VARIANT_NOT_FOUND"
    );
  }

  const normalized: VariantRow = {
    id: String(variant.id),

    product_id: String(
      variant.product_id
    ),

    price: safeNumber(
      variant.price
    ),

    sale_price:
      variant.sale_price !== null
        ? safeNumber(
            variant.sale_price
          )
        : null,

    stock:
      typeof variant.stock ===
      "number"
        ? variant.stock
        : null,

    is_active:
      variant.is_active !== false,

    is_unlimited:
      Boolean(
        variant.is_unlimited
      ),
  };

  if (
    normalized.product_id !==
    productId
  ) {
    throw new Error(
      "VARIANT_PRODUCT_MISMATCH"
    );
  }

  if (
    normalized.is_active === false
  ) {
    throw new Error(
      "VARIANT_INACTIVE"
    );
  }

  return normalized;
}

/* =========================================================
   MAIN ENGINE
========================================================= */

export async function calculatePricing(
  input: PricingInput
): Promise<PricingResult> {
  vlog("START", input);

  if (
    !Array.isArray(input.items) ||
    !input.items.length
  ) {
    throw new Error(
      "INVALID_ITEMS"
    );
  }

  const buyerCountry =
    input.country
      .trim()
      .toUpperCase();

  const buyerZone =
    input.zone ??
    (
      await getZoneByCountry(
        buyerCountry
      )
    ) ??
    "rest_of_world";

  let subtotal = 0;

  let shippingFee = 0;

  const items: PricingItemResult[] =
    [];

  const productSnapshots:
    Record<string, unknown>[] =
    [];

  const variantSnapshots:
    Record<string, unknown>[] =
    [];

  for (const raw of input.items) {
    if (
      !isUUID(raw.product_id)
    ) {
      throw new Error(
        "INVALID_PRODUCT_ID"
      );
    }

    if (
      raw.variant_id &&
      !isUUID(raw.variant_id)
    ) {
      throw new Error(
        "INVALID_VARIANT_ID"
      );
    }

    const quantity = safeQty(
      raw.quantity
    );

    const product =
      await loadProduct(
        raw.product_id
      );

    let unitPrice =
      resolveProductPrice(
        product
      );

    if (
      !product.is_unlimited &&
      product.stock !== null &&
      product.stock !== undefined &&
      product.stock < quantity
    ) {
      throw new Error(
        "OUT_OF_STOCK"
      );
    }

    let variantSnapshot:
      Record<string, unknown> | null =
      null;

    if (raw.variant_id) {
      const variant =
        await loadVariant(
          raw.variant_id,
          product.id
        );

      if (
        !variant.is_unlimited &&
        variant.stock !== null &&
        variant.stock !==
          undefined &&
        variant.stock < quantity
      ) {
        throw new Error(
          "VARIANT_OUT_OF_STOCK"
        );
      }

      unitPrice =
        resolveVariantPrice(
          product,
          variant
        );

      variantSnapshot = {
        variant_id:
          variant.id,

        product_id:
          variant.product_id,

        locked_price:
          unitPrice,

        stock_snapshot:
          variant.stock,

        is_unlimited:
          variant.is_unlimited,
      };

      variantSnapshots.push(
        variantSnapshot
      );
    }

    const lineSubtotal =
      unitPrice * quantity;

    subtotal += lineSubtotal;

    if (
      !product.is_digital
    ) {
      shippingFee +=
        await calculateShippingFee(
          {
            productId:
              product.id,

            buyerCountry,

            buyerZone,
          }
        );
    }

    items.push({
      product_id:
        product.id,

      variant_id:
        raw.variant_id ??
        null,

      name: product.name,

      quantity,

      unit_price:
        unitPrice,

      subtotal:
        lineSubtotal,
    });

    productSnapshots.push({
      product_id:
        product.id,

      seller_id:
        product.seller_id,

      locked_price:
        unitPrice,

      stock_snapshot:
        product.stock,

      is_unlimited:
        product.is_unlimited,

      is_digital:
        product.is_digital,
    });
  }

  const total =
    subtotal + shippingFee;

  const result: PricingResult = {
    items,

    subtotal,

    shipping_fee:
      shippingFee,

    total,

    buyer_country:
      buyerCountry,

    buyer_zone:
      buyerZone,

    snapshots: {
      products:
        productSnapshots,

      variants:
        variantSnapshots,
    },
  };

  vlog("SUCCESS", result);

  return result;
}

/* =========================================================
   SNAPSHOT BUILDER
========================================================= */

export async function buildPricingSnapshot(
  input: PricingInput
): Promise<PricingResult> {
  return calculatePricing(input);
}
