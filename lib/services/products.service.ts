import {
  getAllProducts,
  getProductsByIds,
  createProduct,
  updateProductBySeller,
  deleteProductBySeller,
} from "@/lib/db/products";

import {
  getVariantsByProductId,
  replaceVariantsByProductId,
} from "@/lib/db/variants";

import {
  getShippingRatesByProducts,
  upsertShippingRates,
} from "@/lib/db/shipping";

import { normalizeVariants } from "@/lib/validators/products";

/* =========================================================
   HELPERS
========================================================= */

function getCategoryId(body: any) {
  return body.category_id ?? body.categoryId ?? null;
}

function calcFinalPrice(variants: any[], fallbackPrice: number) {
  if (!variants.length) return fallbackPrice;
  return Math.min(...variants.map(v => Number(v.price || 0)));
}

/**
 * FIX CORE:
 * - luôn nhận primaryShippingCountry rõ ràng
 * - domestic chỉ set country cho zone = domestic
 */
function normalizeShippingRates(
  body: any,
  primaryCountry?: string
) {
  const rates = body.shippingRates || [];

  const country =
  primaryCountry ??
  body.primaryShippingCountry ??
  body.domesticCountryCode ??
  "";

  return rates.map((r: any) => ({
    zone: r.zone,
    price: Number(r.price ?? 0),
    domesticCountryCode:
  r.zone === "domestic" && country
    ? country
    : null,
  }));
}

/* =========================================================
   LIST PRODUCTS
========================================================= */

export async function listProductsService(req: Request) {
  const { searchParams } = new URL(req.url);
  const ids = searchParams.get("ids");

  const products = ids
    ? await getProductsByIds(ids.split(",").filter(Boolean))
    : await getAllProducts();

  const productIds = products.map(p => p.id);

  const shippingRows =
    productIds.length > 0
      ? await getShippingRatesByProducts(productIds)
      : [];

  const shippingMap = new Map<string, any[]>();

  for (const r of shippingRows) {
    if (!shippingMap.has(r.product_id)) {
      shippingMap.set(r.product_id, []);
    }

    shippingMap.get(r.product_id)!.push({
      zone: r.zone,
      price: r.price,
      domesticCountryCode: r.domestic_country_code,
    });
  }

  return Promise.all(
    products.map(async (p) => {
      const variants = await getVariantsByProductId(p.id);

      const enrichedVariants = variants.map((v: any) => {
        const saleActive =
          v.sale_enabled &&
          v.sale_price !== null &&
          v.sale_price > 0 &&
          v.sale_price < v.price;

        return {
          ...v,
          finalPrice: saleActive ? v.sale_price : v.price,
        };
      });

      const prices = enrichedVariants.map(v => v.finalPrice);

      return {
        ...p,
        hasVariants: variants.length > 0,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        variants: enrichedVariants,
        shippingRates: shippingMap.get(p.id) ?? [],
      };
    })
  );
}

/* =========================================================
   CREATE PRODUCT
========================================================= */

export async function createProductService(req: Request, userId: string) {
  const body = await req.json();

  console.log(
    "🌍 primaryShippingCountry =",
    body.primaryShippingCountry
  );

  console.log(
    "📦 shippingRates RAW =",
    body.shippingRates
  );

  const variants = normalizeVariants(body.variants || []);
  const price = calcFinalPrice(variants, Number(body.price || 0));

  const product = await createProduct(userId, {
    name: body.name,
    description: body.description ?? "",
    detail: body.detail ?? "",
    images: body.images ?? [],
    thumbnail: body.thumbnail ?? "",

    category_id: getCategoryId(body),

    price,

    stock: variants.length
      ? variants.reduce((s, v) => s + Number(v.stock || 0), 0)
      : Number(body.stock || 0),

    sale_price: body.salePrice ?? null,
    sale_start: body.saleStart ?? null,
    sale_end: body.saleEnd ?? null,
    sale_stock: Number(body.saleStock ?? 0),
    sale_enabled: Boolean(body.saleEnabled),

    is_active: body.isActive !== false,
  });

  /* ================= VARIANTS ================= */
  if (variants.length) {
    await replaceVariantsByProductId(product.id, variants);
  }

  /* ================= SHIPPING ================= */
  if (body.shippingRates?.length) {
    const cleanedRates = normalizeShippingRates(
      body,
      body.primaryShippingCountry
    );

    await upsertShippingRates({
      productId: product.id,
      rates: cleanedRates,
    });
  }

  return {
    success: true,
    data: { id: product.id },
  };
}

/* =========================================================
   UPDATE PRODUCT (FIXED FULL)
========================================================= */

export async function updateProductService(req: Request, userId: string) {
  const body = await req.json();

  const variants = normalizeVariants(body.variants || []);
  const finalPrice = calcFinalPrice(variants, Number(body.price || 0));

  const updated = await updateProductBySeller(userId, body.id, {
    name: body.name,
    description: body.description,
    detail: body.detail,
    images: body.images,
    thumbnail: body.thumbnail,

    category_id: getCategoryId(body),

    price: finalPrice,

    stock: variants.length
      ? variants.reduce((s, v) => s + Number(v.stock || 0), 0)
      : Number(body.stock || 0),

    sale_price: body.salePrice ?? null,
    sale_enabled: body.saleEnabled ?? false,
    sale_start: body.saleStart ?? null,
    sale_end: body.saleEnd ?? null,
    sale_stock: body.saleStock ?? 0,

    is_active: body.isActive ?? true,
  });

  if (!updated) return { error: "NOT_FOUND" };

  /* ================= VARIANTS ================= */
  await replaceVariantsByProductId(body.id, variants);

  /* ================= SHIPPING (FIXED) ================= */
  if (body.shippingRates?.length) {
    const cleanedRates = normalizeShippingRates(
      body,
      body.primaryShippingCountry
    );

    await upsertShippingRates({
      productId: body.id,
      rates: cleanedRates,
    });
  }

  return {
    success: true,
    data: {
      id: body.id,
      price: finalPrice,
    },
  };
}

/* =========================================================
   DELETE PRODUCT
========================================================= */

export async function deleteProductService(req: Request, userId: string) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return { error: "MISSING_ID" };

  const ok = await deleteProductBySeller(userId, id);

  if (!ok) return { error: "NOT_FOUND" };

  return { success: true };
}
