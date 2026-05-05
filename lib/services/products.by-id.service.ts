import {
  getProductById,
  updateProductBySeller,
  deleteProductById,
} from "@/lib/db/products";

import {
  getVariantsByProductId,
  replaceVariantsByProductId,
} from "@/lib/db/variants";

import {
  getShippingRatesByProduct,
  upsertShippingRates,
} from "@/lib/db/shipping";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeVariants } from "@/lib/validators/products";

/* ================= GET ================= */
export async function getProductService(id: string) {
  if (!id) return { error: "INVALID_PRODUCT_ID" };

  const product = await getProductById(id);
  if (!product) return { error: "PRODUCT_NOT_FOUND" };

  const variants = await getVariantsByProductId(id);
  const shippingRates = await getShippingRatesByProduct(id);

  return {
    ...product,
    variants,
    shippingRates,
  };
}

/* ================= PATCH ================= */
export async function updateProductService(
  id: string,
  userId: string,
  body: any
) {
  if (!id) return { error: "INVALID_PRODUCT_ID" };

  const variants = normalizeVariants(body.variants);
  const hasVariants = variants.length > 0;

  const finalPrice = hasVariants
    ? Math.min(...variants.map((v) => v.price))
    : Number(body.price ?? 0);

  const finalStock = hasVariants
    ? variants.reduce((s, v) => s + v.stock, 0)
    : Number(body.stock ?? 0);

  const updated = await updateProductBySeller(userId, id, {
    name: body.name,
    description: body.description,
    detail: body.detail,
    images: body.images,
    thumbnail: body.thumbnail,
    category_id: body.categoryId,

    price: finalPrice,
    stock: finalStock,

    sale_price: hasVariants ? null : body.salePrice ?? null,
    sale_enabled: body.saleEnabled ?? false,
    sale_stock: body.saleStock ?? 0,
    sale_start: body.saleStart ?? null,
    sale_end: body.saleEnd ?? null,
    is_active: body.isActive,
  });

  if (!updated) return { error: "NOT_FOUND" };

  await replaceVariantsByProductId(id, variants);

  if (Array.isArray(body.shippingRates)) {
    await upsertShippingRates({
      productId: id,
      rates: body.shippingRates,
    });
  }

  return {
    success: true,
    data: {
      id,
      price: finalPrice,
      stock: finalStock,
    },
  };
}

/* ================= DELETE ================= */
export async function deleteProductService(
  id: string,
  userId: string
) {
  const result = await deleteProductById(id, userId);

  if (!result.ok) {
    return { error: result.error };
  }

  if (result.paths?.length) {
    await supabaseAdmin.storage
      .from("products")
      .remove(result.paths);
  }

  return { success: true };
}
