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

import {
  normalizeVariants,
} from "@/lib/validators/products";

/* =====================================================
   HELPERS
===================================================== */

function calcVariantFinalPrice(v: any) {
  const saleActive =
    v.sale_enabled &&
    v.sale_price !== null &&
    v.sale_price > 0 &&
    v.sale_price < v.price;

  return saleActive
    ? Number(v.sale_price)
    : Number(v.price);
}

function normalizeShippingRates(body: any) {
  const rates =
    body.shipping_rates ??
    body.shippingRates ??
    [];

  return rates.map((r: any) => ({
    zone: r.zone,

    price: Number(r.price ?? 0),

    domestic_country_code:
      r.zone === "domestic"
        ? (
            r.domestic_country_code ??
            body.primary_shipping_country ??
            body.primaryShippingCountry ??
            null
          )
        : null,
  }));
}

/* =====================================================
   GET PRODUCT
===================================================== */

export async function getProductService(
  id: string
) {
  console.log(
    "[products.by-id.service][GET] ===== START ====="
  );

  try {
    if (!id) {
      return {
        error: "INVALID_PRODUCT_ID",
      };
    }

    const product =
      await getProductById(id);

    if (!product) {
      return {
        error: "PRODUCT_NOT_FOUND",
      };
    }

    const variants =
      await getVariantsByProductId(id);

    const shipping_rates =
      await getShippingRatesByProduct(id);

    const enrichedVariants =
      variants.map((v: any) => ({
        ...v,

        final_price:
          calcVariantFinalPrice(v),
      }));

    const prices =
      enrichedVariants.map(
        (v: any) => v.final_price
      );

    return {
      ...product,

      has_variants:
        variants.length > 0,

      min_price:
        prices.length
          ? Math.min(...prices)
          : null,

      max_price:
        prices.length
          ? Math.max(...prices)
          : null,

      variants:
        enrichedVariants,

      shipping_rates,
    };
  } catch (error) {
    console.error(
      "[products.by-id.service][GET] ERROR:",
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
    if (!id) {
      return {
        error: "INVALID_PRODUCT_ID",
      };
    }

    const variants =
      normalizeVariants(
        body.variants ?? []
      );

    const hasVariants =
      variants.length > 0;

    const finalPrice =
      hasVariants
        ? Math.min(
            ...variants.map(
              (v: any) =>
                Number(
                  v.final_price
                )
            )
          )
        : Number(
            body.price ?? 0
          );

    const finalStock =
      hasVariants
        ? variants.reduce(
            (
              sum: number,
              v: any
            ) =>
              sum +
              (
                v.is_unlimited
                  ? 0
                  : Number(
                      v.stock ?? 0
                    )
              ),
            0
          )
        : Number(
            body.stock ?? 0
          );

    const payload = {
      name: body.name,

      description:
        body.description,

      detail:
        body.detail,

      images:
        body.images,

      thumbnail:
        body.thumbnail,

      category_id:
        body.category_id ??
        body.categoryId ??
        null,

      price:
        finalPrice,

      stock:
        finalStock,

      sale_price:
        hasVariants
          ? null
          : (
              body.sale_price ??
              null
            ),

      sale_enabled:
        body.sale_enabled ??
        false,

      sale_stock:
        Number(
          body.sale_stock ?? 0
        ),

      sale_start:
        body.sale_start ??
        null,

      sale_end:
        body.sale_end ??
        null,

      is_active:
        body.is_active ??
        true,

      has_variants:
        hasVariants,
    };

    const updated =
      await updateProductBySeller(
        userId,
        id,
        payload
      );

    if (!updated) {
      return {
        error: "NOT_FOUND",
      };
    }

    /* =========================
       VARIANTS
    ========================= */

    await replaceVariantsByProductId(
      id,
      variants
    );

    /* =========================
       SHIPPING
    ========================= */

    const shippingRates =
      body.shipping_rates ??
      body.shippingRates;

    if (
      Array.isArray(
        shippingRates
      )
    ) {
      const cleanedRates =
        normalizeShippingRates(
          body
        );

      await upsertShippingRates({
        productId: id,
        rates: cleanedRates,
      });
    }

    return {
      success: true,

      data: {
        id,

        price:
          finalPrice,

        stock:
          finalStock,

        has_variants:
          hasVariants,
      },
    };
  } catch (error) {
    console.error(
      "[products.by-id.service][PATCH] ERROR:",
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
    if (!id) {
      return {
        error: "INVALID_PRODUCT_ID",
      };
    }

    const product =
      await getProductById(id);

    if (!product) {
      return {
        error: "PRODUCT_NOT_FOUND",
      };
    }

    const paths: string[] = [];

    const collectPath = (
      url?: string | null
    ) => {
      if (!url) {
        return;
      }

      const marker =
        "/products/";

      const index =
        url.indexOf(marker);

      if (index === -1) {
        return;
      }

      const path =
        url.substring(
          index +
            marker.length
        );

      if (path) {
        paths.push(path);
      }
    };

    collectPath(
      product.thumbnail
    );

    if (
      Array.isArray(
        product.images
      )
    ) {
      for (const image of product.images) {
        collectPath(image);
      }
    }

    const result =
      await deleteProductById(
        id,
        userId
      );

    if (!result.ok) {
      return {
        error:
          "DELETE_FAILED",
      };
    }

    if (paths.length) {
      await supabaseAdmin.storage
        .from("products")
        .remove(paths);
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "[products.by-id.service][DELETE] ERROR:",
      error
    );

    return {
      error: "INTERNAL_SERVER_ERROR",
    };
  }
}
