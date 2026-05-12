

import { query } from "@/lib/db";

import {
  getShippingRatesByProduct,
  getZoneByCountry,
} from "@/lib/db/shipping";

import {
  getProductById,
} from "@/lib/db/products";

import {
  getVariantById,
} from "@/lib/db/variants";

/* =========================================================
   TYPES
========================================================= */

type PreviewItemInput = {
  product_id: string;
  quantity: number;
  variant_id?: string | null;
};

type PreviewOrderInput = {
  userId: string;
  items: PreviewItemInput[];
  country: string;
  zone?: string;
};

type PreviewOrderResult = {
  items: {
    product_id: string;
    variant_id: string | null;
    name: string;
    price: number;
    quantity: number;
    total: number;
  }[];

  subtotal: number;
  shipping_fee: number;
  total: number;
  buyer_zone: string;
};

/* =========================================================
   PRODUCT TYPES
========================================================= */

type ProductRow = {
  id: string;
  name: string;
  price: number;
  sale_price: number | null;
  sale_start: string | null;
  sale_end: string | null;

  status?: string | null;
  deleted_at?: string | null;
};

type VariantRow = {
  id: string;
  product_id: string;

  price: number;
  sale_price: number | null;

  stock?: number | null;
  is_active?: boolean | null;
};

/* =========================================================
   HELPERS
========================================================= */

function log(tag: string, data?: unknown) {
  console.log(`[ORDER PREVIEW V7][${tag}]`, data ?? "");
}

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

function safeQty(v: unknown): number {
  const n = Number(v);

  if (!Number.isInteger(n) || n <= 0) {
    return 1;
  }

  return Math.min(n, 100);
}

function isSaleActive(params: {
  sale_start: string | null;
  sale_end: string | null;
}): boolean {
  const now = Date.now();

  const start = params.sale_start
    ? new Date(params.sale_start).getTime()
    : null;

  const end = params.sale_end
    ? new Date(params.sale_end).getTime()
    : null;

  return (
    start !== null &&
    end !== null &&
    now >= start &&
    now <= end
  );
}

function resolveProductPrice(product: ProductRow): number {
  const active = isSaleActive({
    sale_start: product.sale_start,
    sale_end: product.sale_end,
  });

  if (
    active &&
    product.sale_price !== null &&
    Number(product.sale_price) > 0
  ) {
    return Number(product.sale_price);
  }

  return Number(product.price);
}

function resolveVariantPrice(
  product: ProductRow,
  variant: VariantRow
): number {
  const active = isSaleActive({
    sale_start: product.sale_start,
    sale_end: product.sale_end,
  });

  if (
    active &&
    variant.sale_price !== null &&
    Number(variant.sale_price) > 0
  ) {
    return Number(variant.sale_price);
  }

  return Number(variant.price);
}

function chooseShippingPrice(params: {
  rates: Awaited<ReturnType<typeof getShippingRatesByProduct>>;
  buyerCountry: string;
  buyerZone: string | null;
}): number {
  const {
    rates,
    buyerCountry,
    buyerZone,
  } = params;

  const domestic = rates.find(
    (r) =>
      r.zone === "domestic" &&
      (r.domesticCountryCode || "").toUpperCase() ===
        buyerCountry
  );

  if (domestic) {
    return Number(domestic.price);
  }

  if (buyerZone) {
    const regional = rates.find(
      (r) => r.zone === buyerZone
    );

    if (regional) {
      return Number(regional.price);
    }
  }

  const global = rates.find(
    (r) => r.zone === "rest_of_world"
  );

  if (global) {
    return Number(global.price);
  }

  throw new Error("SHIPPING_NOT_AVAILABLE");
}

/* =========================================================
   VALIDATORS
========================================================= */

async function validateProduct(
  productId: string
): Promise<ProductRow> {
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const normalized: ProductRow = {
    id: String(product.id),
    name: String(product.name),
    price: Number(product.price),
    sale_price:
      product.sale_price !== null
        ? Number(product.sale_price)
        : null,
    sale_start:
      product.sale_start !== null
        ? String(product.sale_start)
        : null,
    sale_end:
      product.sale_end !== null
        ? String(product.sale_end)
        : null,

    status:
      "status" in product
        ? String(product.status ?? "")
        : null,

    deleted_at:
      "deleted_at" in product
        ? String(product.deleted_at ?? "")
        : null,
  };

  if (normalized.deleted_at) {
    throw new Error("PRODUCT_DELETED");
  }

  return normalized;
}

async function validateVariant(
  variantId: string,
  productId: string
): Promise<VariantRow> {
  const variant = await getVariantById(variantId);

  if (!variant) {
    throw new Error("VARIANT_NOT_FOUND");
  }

  const normalized: VariantRow = {
    id: String(variant.id),
    product_id: String(variant.product_id),

    price: Number(variant.price),

    sale_price:
      variant.sale_price !== null
        ? Number(variant.sale_price)
        : null,

    stock:
      "stock" in variant &&
      typeof variant.stock === "number"
        ? variant.stock
        : null,

    is_active:
      "is_active" in variant &&
      typeof variant.is_active === "boolean"
        ? variant.is_active
        : null,
  };

  if (normalized.product_id !== productId) {
    throw new Error("VARIANT_PRODUCT_MISMATCH");
  }

  if (normalized.is_active === false) {
    throw new Error("VARIANT_INACTIVE");
  }

  return normalized;
}

/* =========================================================
   MAIN
========================================================= */

export async function previewOrder(
  input: PreviewOrderInput
): Promise<PreviewOrderResult> {
  log("START", input);

  const {
    userId,
    items,
    country,
  } = input;

  if (!userId) {
    throw new Error("INVALID_USER");
  }

  if (!country) {
    throw new Error("INVALID_COUNTRY");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("INVALID_ITEMS");
  }

  /* =====================================================
     CLEAN ITEMS
  ===================================================== */

  const cleanItems = items.map((item) => {
    if (!isUUID(item.product_id)) {
      throw new Error("INVALID_PRODUCT_ID");
    }

    if (
      item.variant_id &&
      !isUUID(item.variant_id)
    ) {
      throw new Error("INVALID_VARIANT_ID");
    }

    return {
      product_id: item.product_id,
      variant_id: item.variant_id ?? null,
      quantity: safeQty(item.quantity),
    };
  });

  log("CLEAN_ITEMS", cleanItems);

  /* =====================================================
     BUYER GEO
  ===================================================== */

  const buyerCountry = country
    .trim()
    .toUpperCase();

  const buyerZone =
    await getZoneByCountry(buyerCountry);

  log("BUYER_GEO", {
    buyerCountry,
    buyerZone,
  });

  /* =====================================================
     LOAD + VALIDATE
  ===================================================== */

  let subtotal = 0;

  const previewItems: PreviewOrderResult["items"] =
    [];

  for (const item of cleanItems) {
    const product = await validateProduct(
      item.product_id
    );

    let price = resolveProductPrice(product);

    if (item.variant_id) {
      const variant = await validateVariant(
        item.variant_id,
        product.id
      );

      if (
        variant.stock !== null &&
        variant.stock < item.quantity
      ) {
        throw new Error("VARIANT_OUT_OF_STOCK");
      }

      price = resolveVariantPrice(
        product,
        variant
      );
    }

    const total = price * item.quantity;

    subtotal += total;

    previewItems.push({
      product_id: product.id,
      variant_id: item.variant_id,
      name: product.name,
      price,
      quantity: item.quantity,
      total,
    });
  }

  log("SUBTOTAL_OK", subtotal);

  /* =====================================================
     SHIPPING
  ===================================================== */

  let shippingFee = 0;

  for (const item of cleanItems) {
    const rates =
      await getShippingRatesByProduct(
        item.product_id
      );

    const matched = chooseShippingPrice({
      rates,
      buyerCountry,
      buyerZone,
    });

    shippingFee += matched;
  }

  log("SHIPPING_OK", shippingFee);

  /* =====================================================
     TOTAL
  ===================================================== */

  const total = subtotal + shippingFee;

  log("SUCCESS", {
    subtotal,
    shippingFee,
    total,
    buyerZone:
      buyerZone ?? "rest_of_world",
  });

  return {
    items: previewItems,

    subtotal,

    shipping_fee: shippingFee,

    total,

    buyer_zone:
      buyerZone ?? "rest_of_world",
  };
}
