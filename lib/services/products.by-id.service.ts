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

/* =====================================================
   GET PRODUCT
===================================================== */
export async function getProductService(id: string) {
  console.log(
    "[products.by-id.service][GET] ===== START ====="
  );

  try {
    console.log(
      "[products.by-id.service][GET] Incoming product id:",
      id
    );

    if (!id) {
      console.error(
        "[products.by-id.service][GET] INVALID_PRODUCT_ID"
      );

      return { error: "INVALID_PRODUCT_ID" };
    }

    console.log(
      "[products.by-id.service][GET] Fetching product..."
    );

    const product = await getProductById(id);

    console.log(
      "[products.by-id.service][GET] Product result:",
      product
    );

    if (!product) {
      console.error(
        "[products.by-id.service][GET] PRODUCT_NOT_FOUND"
      );

      return { error: "PRODUCT_NOT_FOUND" };
    }

    console.log(
      "[products.by-id.service][GET] Fetching variants..."
    );

    const variants = await getVariantsByProductId(id);

    console.log(
      "[products.by-id.service][GET] Variants count:",
      variants?.length ?? 0
    );

    console.log(
      "[products.by-id.service][GET] Variants data:",
      variants
    );

    console.log(
      "[products.by-id.service][GET] Fetching shipping rates..."
    );

    const shippingRates =
      await getShippingRatesByProduct(id);

    console.log(
      "[products.by-id.service][GET] Shipping rates:",
      shippingRates
    );

    const enrichedVariants = variants.map((v) => ({
      ...v,
      finalPrice:
        v.saleEnabled &&
        v.salePrice &&
        v.salePrice < v.price
          ? v.salePrice
          : v.price,
    }));

    console.log(
      "[products.by-id.service][GET] Enriched variants:",
      enrichedVariants
    );

    const prices = enrichedVariants.map(
      (v) => v.finalPrice
    );

    console.log(
      "[products.by-id.service][GET] Calculated prices:",
      prices
    );

    const response = {
      ...product,
      hasVariants: variants.length > 0,
      minPrice: prices.length
        ? Math.min(...prices)
        : null,
      maxPrice: prices.length
        ? Math.max(...prices)
        : null,
      variants: enrichedVariants,
      shippingRates,
    };

    console.log(
      "[products.by-id.service][GET] Final response:",
      response
    );

    console.log(
      "[products.by-id.service][GET] ===== SUCCESS ====="
    );

    return response;
  } catch (error) {
    console.error(
      "[products.by-id.service][GET] UNHANDLED ERROR:",
      error
    );

    return {
      error: "INTERNAL_SERVER_ERROR",
    };
  }
}

/* =====================================================
   UPDATE PRODUCT
===================================================== */
export async function updateProductService(
  id: string,
  userId: string,
  body: any
) {
  console.log(
    "[products.by-id.service][PATCH] ===== START ====="
  );

  try {
    console.log(
      "[products.by-id.service][PATCH] Product id:",
      id
    );

    console.log(
      "[products.by-id.service][PATCH] User id:",
      userId
    );

    console.log(
      "[products.by-id.service][PATCH] Request body:",
      body
    );

    if (!id) {
      console.error(
        "[products.by-id.service][PATCH] INVALID_PRODUCT_ID"
      );

      return { error: "INVALID_PRODUCT_ID" };
    }

    console.log(
      "[products.by-id.service][PATCH] Normalizing variants..."
    );

    const variants = normalizeVariants(body.variants);

    console.log(
      "[products.by-id.service][PATCH] Normalized variants:",
      variants
    );

    const hasVariants = variants.length > 0;

    console.log(
      "[products.by-id.service][PATCH] hasVariants:",
      hasVariants
    );

    const finalPrice = hasVariants
      ? Math.min(...variants.map((v) => v.price))
      : Number(body.price ?? 0);

    console.log(
      "[products.by-id.service][PATCH] finalPrice:",
      finalPrice
    );

    const finalStock = hasVariants
      ? variants.reduce(
          (s, v) => s + v.stock,
          0
        )
      : Number(body.stock ?? 0);

    console.log(
      "[products.by-id.service][PATCH] finalStock:",
      finalStock
    );

    const payload = {
      name: body.name,
      description: body.description,
      detail: body.detail,
      images: body.images,
      thumbnail: body.thumbnail,
      has_variants: hasVariants,
      category_id:  body.category_id ??  body.categoryId ??  null,
      domestic_country_code:  body.domestic_country_code ??  body.domesticCountryCode ??  null,
      price: finalPrice,
      stock: finalStock,

      sale_price: hasVariants
        ? null
        : body.salePrice ?? null,

      sale_enabled:
        body.saleEnabled ?? false,

      sale_stock: body.saleStock ?? 0,

      sale_start:
  body.saleStart ?? body.sale_start ?? null,

sale_end:
  body.saleEnd ?? body.sale_end ?? null,

      is_active: body.isActive,
    };

    console.log(
      "[products.by-id.service][PATCH] Update payload:",
      payload
    );

    console.log(
      "[products.by-id.service][PATCH] Updating product..."
    );

    const updated =
      await updateProductBySeller(
        userId,
        id,
        payload
      );

    console.log(
      "[products.by-id.service][PATCH] Update result:",
      updated
    );

    if (!updated) {
      console.error(
        "[products.by-id.service][PATCH] Product not found or update failed"
      );

      return { error: "NOT_FOUND" };
    }

    console.log(
      "[products.by-id.service][PATCH] Replacing variants..."
    );

    await replaceVariantsByProductId(
      id,
      variants
    );

    console.log(
      "[products.by-id.service][PATCH] Variants replaced successfully"
    );

    console.log(
      "[products.by-id.service][PATCH] Syncing final product price/stock..."
    );

    const syncResult =
      await updateProductBySeller(
        userId,
        id,
        {
          price: finalPrice,
          stock: finalStock,
        }
      );

    console.log(
      "[products.by-id.service][PATCH] Sync result:",
      syncResult
    );

    if (
  Array.isArray(body.shippingRates)
) {
  console.log(
    "[products.by-id.service][PATCH] Updating shipping rates..."
  );

  const shippingRatesPayload =
    body.shippingRates.map((r: any) => ({
      ...r,

      domestic_country_code:
        r.zone === "domestic"
          ? (
              body.domestic_country_code ??
              body.domesticCountryCode ??
              null
            )
          : null,
    }));

  console.log(
    "[products.by-id.service][PATCH] Shipping rates payload:",
    shippingRatesPayload
  );

  await upsertShippingRates({
    productId: id,
    rates: shippingRatesPayload,
  });

  console.log(
    "[products.by-id.service][PATCH] Shipping rates updated successfully"
  );
} else {
  console.log(
    "[products.by-id.service][PATCH] No shippingRates provided"
  );
}

    const response = {
      success: true,
      data: {
        id,
        price: finalPrice,
        stock: finalStock,
      },
    };

    console.log(
      "[products.by-id.service][PATCH] Final response:",
      response
    );

    console.log(
      "[products.by-id.service][PATCH] ===== SUCCESS ====="
    );

    return response;
  } catch (error) {
    console.error(
      "[products.by-id.service][PATCH] UNHANDLED ERROR:",
      error
    );

    return {
      error: "INTERNAL_SERVER_ERROR",
    };
  }
}

/* =====================================================
   DELETE PRODUCT
===================================================== */
export async function deleteProductService(
  id: string,
  userId: string
) {
  console.log(
    "[products.by-id.service][DELETE] ===== START ====="
  );

  try {
    console.log(
      "[products.by-id.service][DELETE] Product id:",
      id
    );

    console.log(
      "[products.by-id.service][DELETE] User id:",
      userId
    );

    console.log(
      "[products.by-id.service][DELETE] Deleting product..."
    );

    const result = await deleteProductById(
      id,
      userId
    );

    console.log(
      "[products.by-id.service][DELETE] Delete result:",
      result
    );

    if (!result.ok) {
      console.error(
        "[products.by-id.service][DELETE] Delete failed:",
        result.error
      );

      return {
        error: result.error,
      };
    }

    if (result.paths?.length) {
      console.log(
        "[products.by-id.service][DELETE] Removing storage files..."
      );

      console.log(
        "[products.by-id.service][DELETE] Paths:",
        result.paths
      );

      const storageResult =
        await supabaseAdmin.storage
          .from("products")
          .remove(result.paths);

      console.log(
        "[products.by-id.service][DELETE] Storage remove result:",
        storageResult
      );
    } else {
      console.log(
        "[products.by-id.service][DELETE] No storage files to remove"
      );
    }

    console.log(
      "[products.by-id.service][DELETE] ===== SUCCESS ====="
    );

    return { success: true };
  } catch (error) {
    console.error(
      "[products.by-id.service][DELETE] UNHANDLED ERROR:",
      error
    );

    return {
      error: "INTERNAL_SERVER_ERROR",
    };
  }
}
