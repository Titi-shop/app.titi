import {
  getProductById,
  updateProductBySeller,
  deleteProductById,
  type UpdateProductInput,
} from "@/lib/db/products";

import {
  getVariantsByProductId,
  replaceVariantsByProductId,
  type ProductVariantRecord,
} from "@/lib/db/variants";

import {
  getShippingRatesByProduct,
  upsertShippingRates,
  type ShippingRateInput,
} from "@/lib/db/shipping";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  normalizeVariants,
  validateProductPayload,
} from "@/lib/validators/products";

/* =====================================================
   TYPES
===================================================== */

type ProductRequestBody = {
  name?: string;
  description?: string;
  detail?: string;
  images?: string[];
  thumbnail?: string;
  category_id?: number | null;
  price?: number;
  stock?: number;
  sale_price?: number | null;
  sale_enabled?: boolean;
  sale_stock?: number;
  sale_start?: string | null;
  sale_end?: string | null;
  is_active?: boolean;
  primary_shipping_country?: string | null;
  shipping_rates?: ShippingRateBody[];
  variants?: ProductVariantRecord[];
};

type ShippingRateBody = {
  zone: string;
  price?: number;
  domestic_country_code?: string | null;
};

type VariantPricing = {
  price: number;
  sale_price: number | null;
  final_price: number;
  stock: number;
  is_unlimited: boolean;
};

/* =====================================================
   HELPERS
===================================================== */

function calcVariantFinalPrice(v: ProductVariantRecord): number {
  const saleActive =
    v.sale_enabled &&
    v.sale_price !== null &&
    Number(v.sale_price) > 0 &&
    Number(v.sale_price) < Number(v.price);

  return saleActive ? Number(v.sale_price) : Number(v.price);
}

function normalizeShippingRates(
  body: ProductRequestBody
): ShippingRateInput[] {
  const rates = body.shipping_rates ?? [];

  return rates.map((r) => ({
    zone: r.zone,
    price: Number(r.price ?? 0),
    domestic_country_code:
      r.zone === "domestic"
        ? r.domestic_country_code ??
          body.primary_shipping_country ??
          null
        : null,
  }));
}

function isUUID(id: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(id);
}

/* =====================================================
   GET PRODUCT
===================================================== */

export async function getProductService(id: string) {
  try {
    if (!isUUID(id)) {
      return { error: "INVALID_PRODUCT_ID" };
    }

    const product = await getProductById(id);
    if (!product) {
      return { error: "PRODUCT_NOT_FOUND" };
    }

    const shipping_rates = await getShippingRatesByProduct(id);

    const variants: ProductVariantRecord[] =
      product.has_variants
        ? await getVariantsByProductId(id)
        : [];

    const enrichedVariants = variants.map((v) => ({
      ...v,
      final_price: calcVariantFinalPrice(v),
    }));

    const prices: number[] = enrichedVariants.map((v) =>
      Number(v.final_price)
    );

    const min_price =
      prices.length > 0 ? Math.min(...prices) : null;

    const max_price =
      prices.length > 0 ? Math.max(...prices) : null;

    return {
      ...product,
      has_variants: product.has_variants,
      variants: enrichedVariants,
      min_price,
      max_price,
      shipping_rates,
    };
  } catch (error: unknown) {
    console.error("[GET_PRODUCT_ERROR]", error);
    return { error: "INTERNAL_SERVER_ERROR" };
  }
}

/* =====================================================
   UPDATE PRODUCT
===================================================== */

export async function updateProductService(
  id: string,
  userId: string,
  body: ProductRequestBody
) {
  try {
    if (!isUUID(id)) {
      return { error: "INVALID_PRODUCT_ID" };
    }

    const product = await getProductById(id);
    if (!product) {
      return { error: "PRODUCT_NOT_FOUND" };
    }

    const validationError = validateProductPayload({
      ...body,
      variants: body.variants ?? [],
    });

    if (validationError) {
      return { error: validationError };
    }

    const variants = normalizeVariants(body.variants ?? []);

    const hasVariants =
      Array.isArray(body.variants)
        ? variants.length > 0
        : Boolean(product.has_variants);

    const finalPrice: number = hasVariants
      ? Math.min(
          ...variants.map((v) =>
            Number(v.final_price ?? v.price ?? 0)
          )
        )
      : Number(body.price ?? product.price);

    const finalStock: number = hasVariants
      ? variants.reduce((sum, v) => {
          const stock = Number(v.stock ?? 0);
          return sum + (v.is_unlimited ? 0 : stock);
        }, 0)
      : Number(body.stock ?? product.stock);

    const payload: UpdateProductInput = {
      name: body.name,
      description: body.description,
      detail: body.detail,
      images: body.images,
      thumbnail: body.thumbnail,
      category_id: body.category_id ?? null,

      price: finalPrice,
      stock: finalStock,

      sale_price: hasVariants ? null : body.sale_price ?? null,
      sale_enabled: body.sale_enabled ?? false,
      sale_stock: Number(body.sale_stock ?? 0),
      sale_start: body.sale_start ?? null,
      sale_end: body.sale_end ?? null,

      is_active: body.is_active ?? true,
      has_variants: hasVariants,
    };

    const updated = await updateProductBySeller(userId, id, payload);

    if (!updated) {
      return { error: "NOT_FOUND" };
    }

    await replaceVariantsByProductId(id, variants);

    const shipping_rates = body.shipping_rates
      ? normalizeShippingRates(body)
      : [];

    await upsertShippingRates({
      productId: id,
      rates: shipping_rates,
    });

    return {
      success: true,
      data: {
        id,
        price: finalPrice,
        stock: finalStock,
        has_variants: hasVariants,
      },
    };
  } catch (error: unknown) {
    console.error("[UPDATE_PRODUCT_ERROR]", error);
    return { error: "INTERNAL_SERVER_ERROR" };
  }
}

/* =====================================================
   DELETE PRODUCT
===================================================== */

export async function deleteProductService(
  id: string,
  userId: string
) {
  try {
    if (!isUUID(id)) {
      return { error: "INVALID_PRODUCT_ID" };
    }

    const product = await getProductById(id);
    if (!product) {
      return { error: "PRODUCT_NOT_FOUND" };
    }

    const paths: string[] = [];

    const collect = (url?: string | null): void => {
      if (!url) return;

      const marker = "/products/";
      const index = url.indexOf(marker);
      if (index === -1) return;

      const path = url.substring(index + marker.length);
      if (path) paths.push(path);
    };

    collect(product.thumbnail);

    if (Array.isArray(product.images)) {
      product.images.forEach(collect);
    }

    const result = await deleteProductById(id, userId);

    if (!result.ok) {
      return { error: "DELETE_FAILED" };
    }

    if (paths.length > 0) {
      await supabaseAdmin.storage.from("products").remove(paths);
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("[DELETE_PRODUCT_ERROR]", error);
    return { error: "INTERNAL_SERVER_ERROR" };
  }
}
