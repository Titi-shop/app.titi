

import { query } from "@/lib/db";
import {
  getShippingRatesByProduct,
  getZoneByCountry,
} from "@/lib/db/shipping";

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
  zone?: string; // ignored from client in V7
};

type PreviewOrderResult = {
  items: {
    product_id: string;
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
   HELPERS
========================================================= */

function log(tag: string, data?: unknown) {
  console.log(`[ORDER PREVIEW V7][${tag}]`, data ?? "");
}

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function safeQty(q: unknown): number {
  const n = Number(q);
  if (!Number.isInteger(n) || n <= 0) return 1;
  return Math.min(n, 100);
}

function chooseShippingPrice(params: {
  rates: Awaited<ReturnType<typeof getShippingRatesByProduct>>;
  buyerCountry: string;
  buyerZone: string | null;
}): number {
  const { rates, buyerCountry, buyerZone } = params;

  const domestic = rates.find(
    (r) =>
      r.zone === "domestic" &&
      (r.domesticCountryCode || "").toUpperCase() === buyerCountry
  );

  if (domestic) {
    return Number(domestic.price);
  }

  if (buyerZone) {
    const regional = rates.find((r) => r.zone === buyerZone);
    if (regional) {
      return Number(regional.price);
    }
  }

  const global = rates.find((r) => r.zone === "rest_of_world");
  if (global) {
    return Number(global.price);
  }

  throw new Error("SHIPPING_NOT_AVAILABLE");
}

function resolveProductSalePrice(p: {
  price: number;
  sale_price: number | null;
  sale_start: string | null;
  sale_end: string | null;
}): number {
  const now = Date.now();

  const start = p.sale_start ? new Date(p.sale_start).getTime() : null;
  const end = p.sale_end ? new Date(p.sale_end).getTime() : null;

  const active =
    start !== null &&
    end !== null &&
    now >= start &&
    now <= end;

  if (active && p.sale_price && Number(p.sale_price) > 0) {
    return Number(p.sale_price);
  }

  return Number(p.price);
}

function resolveVariantSalePrice(
  baseSaleActive: boolean,
  v: {
    price: number;
    sale_price: number | null;
  }
): number {
  if (baseSaleActive && v.sale_price && Number(v.sale_price) > 0) {
    return Number(v.sale_price);
  }

  return Number(v.price);
}

/* =========================================================
   MAIN
========================================================= */

export async function previewOrder(
  input: PreviewOrderInput
): Promise<PreviewOrderResult> {
  log("START", input);

  const { userId, items, country } = input;

  if (!userId) throw new Error("INVALID_USER");
  if (!country) throw new Error("INVALID_COUNTRY");
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("INVALID_ITEMS");
  }

  /* =====================================================
     CLEAN ITEMS
  ===================================================== */

  const cleanItems = items.map((i) => {
    if (!isUUID(i.product_id)) {
      throw new Error("INVALID_PRODUCT_ID");
    }

    if (i.variant_id && !isUUID(i.variant_id)) {
      throw new Error("INVALID_VARIANT_ID");
    }

    return {
      product_id: i.product_id,
      variant_id: i.variant_id ?? null,
      quantity: safeQty(i.quantity),
    };
  });

  log("CLEAN_ITEMS", cleanItems);

  const buyerCountry = country.trim().toUpperCase();
  const buyerZone = await getZoneByCountry(buyerCountry);

  log("BUYER_GEO", {
    buyerCountry,
    buyerZone,
  });

  const productIds = cleanItems.map((i) => i.product_id);

  /* =====================================================
     LOAD PRODUCTS
  ===================================================== */

  const { rows: products } = await query<{
    id: string;
    name: string;
    price: number;
    sale_price: number | null;
    sale_start: string | null;
    sale_end: string | null;
  }>(
    `
    SELECT id, name, price, sale_price, sale_start, sale_end
    FROM products
    WHERE id = ANY($1::uuid[])
    `,
    [productIds]
  );

  const productMap = new Map(products.map((p) => [p.id, p]));

  /* =====================================================
     LOAD VARIANTS
  ===================================================== */

  const variantIds = cleanItems
    .map((i) => i.variant_id)
    .filter(Boolean);

  const { rows: variants } =
    variantIds.length > 0
      ? await query<{
          id: string;
          product_id: string;
          price: number;
          sale_price: number | null;
        }>(
          `
          SELECT id, product_id, price, sale_price
          FROM product_variants
          WHERE id = ANY($1::uuid[])
          `,
          [variantIds]
        )
      : { rows: [] };

  const variantMap = new Map(variants.map((v) => [v.id, v]));

  /* =====================================================
     CALCULATE ITEM MONEY
  ===================================================== */

  let subtotal = 0;

  const previewItems = cleanItems.map((item) => {
    const p = productMap.get(item.product_id);

    if (!p) {
      throw new Error("INVALID_PRODUCT");
    }

    const now = Date.now();
    const start = p.sale_start ? new Date(p.sale_start).getTime() : null;
    const end = p.sale_end ? new Date(p.sale_end).getTime() : null;

    const saleActive =
      start !== null &&
      end !== null &&
      now >= start &&
      now <= end;

    let price = resolveProductSalePrice(p);

    if (item.variant_id) {
      const v = variantMap.get(item.variant_id);
      if (!v) throw new Error("INVALID_VARIANT");

      price = resolveVariantSalePrice(saleActive, v);
    }

    const total = price * item.quantity;
    subtotal += total;

    return {
      product_id: p.id,
      name: p.name,
      price,
      quantity: item.quantity,
      total,
    };
  });

  log("SUBTOTAL_OK", subtotal);

  /* =====================================================
     SHIPPING CALCULATE
  ===================================================== */

  let shippingFee = 0;

  for (const item of cleanItems) {
    const rates = await getShippingRatesByProduct(item.product_id);

    const matched = chooseShippingPrice({
      rates,
      buyerCountry,
      buyerZone,
    });

    shippingFee += matched;
  }

  log("SHIPPING_OK", shippingFee);

  const total = subtotal + shippingFee;

  log("SUCCESS", {
    subtotal,
    shippingFee,
    total,
    buyerZone: buyerZone ?? "rest_of_world",
  });

  return {
    items: previewItems,
    subtotal,
    shipping_fee: shippingFee,
    total,
    buyer_zone: buyerZone ?? "rest_of_world",
  };
}
