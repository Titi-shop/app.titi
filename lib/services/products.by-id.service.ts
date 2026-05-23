import {
  getProductById,
  updateProductBySeller,
  deleteProductById,
  type ProductRecord,
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
  domestic_country_code?:
    | string
    | null;
};

/* =====================================================
   HELPERS
===================================================== */

function calcVariantFinalPrice(
  variant: ProductVariantRecord
): number {
  const saleActive =
    variant.sale_enabled &&
    variant.sale_price !== null &&
    Number(variant.sale_price) > 0 &&
    Number(variant.sale_price) <
      Number(variant.price);

  return saleActive
    ? Number(variant.sale_price)
    : Number(variant.price);
}

function normalizeShippingRates(
  body: ProductRequestBody
): ShippingRateInput[] {
  const shippingRates =
    body.shipping_rates ?? [];

  return shippingRates.map(
    (rate) => ({
      zone: rate.zone,

      price: Number(
        rate.price ?? 0
      ),

      domestic_country_code:
        rate.zone ===
        "domestic"
          ? (
              rate.domestic_country_code ??
              body.primary_shipping_country ??
              null
            )
          : null,
    })
  );
}

/* =====================================================
   GET PRODUCT
===================================================== */

export async function getProductService(
  id: string
) {
  console.log(
    "[products.by-id.service][GET] START"
  );

  try {
    if (!id) {
      return {
        error:
          "INVALID_PRODUCT_ID",
      };
    }

    const product =
      await getProductById(id);

    if (!product) {
      return {
        error:
          "PRODUCT_NOT_FOUND",
      };
    }

    const variants =
      await getVariantsByProductId(
        id
      );

    const shippingRates =
      await getShippingRatesByProduct(
        id
      );

    const enrichedVariants =
      variants.map((variant) => ({
        ...variant,

        final_price:
          calcVariantFinalPrice(
            variant
          ),
      }));

    const prices =
      enrichedVariants.map(
        (variant) =>
          Number(
            variant.final_price
          )
      );

    return {
      ...product,

      has_variants:
        variants.length > 0,

      min_price:
        prices.length > 0
          ? Math.min(...prices)
          : null,

      max_price:
        prices.length > 0
          ? Math.max(...prices)
          : null,

      variants:
        enrichedVariants,

      shipping_rates:
        shippingRates,
    };
  } catch (error) {
    console.error(
      "[products.by-id.service][GET] ERROR",
      error
    );

    return {
      error:
        "INTERNAL_SERVER_ERROR",
    };
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
  console.log(
    "[products.by-id.service][PATCH] START"
  );

  try {
    if (!id) {
      return {
        error:
          "INVALID_PRODUCT_ID",
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
              (variant) =>
                Number(
                  variant.final_price
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
              total,
              variant
            ) =>
              total +
              (
                variant.is_unlimited
                  ? 0
                  : Number(
                      variant.stock ??
                        0
                    )
              ),
            0
          )
        : Number(
            body.stock ?? 0
          );

    const payload: UpdateProductInput =
      {
        name: body.name,
        description: body.description,
        detail:   body.detail,
        images:  body.images,
        thumbnail:   body.thumbnail,
        category_id:    body.category_id ??   null,
        price:   finalPrice,
        stock:  finalStock,
        sale_price:   hasVariants   ? null
            : (
                body.sale_price ??
                null
              ),

        sale_enabled:
          body.sale_enabled ??
          false,

        sale_stock:
          Number(
            body.sale_stock ??
              0
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

    /* =====================
       VARIANTS
    ===================== */

    await replaceVariantsByProductId(
      id,
      variants
    );

    /* =====================
       SHIPPING
    ===================== */

    const cleanedRates =
      normalizeShippingRates(
        body
      );

    await upsertShippingRates({
      product_id: id,

      rates:
        cleanedRates,
    });

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
      "[products.by-id.service][PATCH] ERROR",
      error
    );

    return {
      error:
        "INTERNAL_SERVER_ERROR",
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
    "[products.by-id.service][DELETE] START"
  );

  try {
    if (!id) {
      return {
        error:
          "INVALID_PRODUCT_ID",
      };
    }

    const product =
      await getProductById(id);

    if (!product) {
      return {
        error:
          "PRODUCT_NOT_FOUND",
      };
    }

    const paths: string[] = [];

    function collectPath(
      url?: string | null
    ) {
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
    }

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

    if (paths.length > 0) {
      await supabaseAdmin.storage
        .from("products")
        .remove(paths);
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "[products.by-id.service][DELETE] ERROR",
      error
    );

    return {
      error:
        "INTERNAL_SERVER_ERROR",
    };
  }
}
