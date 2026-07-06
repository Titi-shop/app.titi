import { createProduct } from "@/lib/db/products";

import {
  replaceVariantsByProductId,
} from "@/lib/db/variants";

import {
  upsertShippingRates,
} from "@/lib/db/shipping";

import {
  normalizeVariants,
  validateProductPayload,
} from "@/lib/validators/products";

import {
  ProductRequestBody,
} from "./types";

import {
  getCategoryId,
  normalizeShippingRates,
  buildSaleFields,
  buildProductFields,
} from "./helpers";
import {
  log,
  logError,
  maskId,
} from "@/lib/db/products/helpers";
/* =========================================================
   CREATE PRODUCT
========================================================= */

export async function createProductService(
  req: Request,
  userId: string
) {
  try {
    const body =
      (await req.json()) as ProductRequestBody;

    log(
  "CREATE_REQUEST",
  {
    hasVariants:
      body.has_variants,
    imageCount:
      body.images?.length ?? 0,
    variantCount:
      body.variants?.length ?? 0,
  }
);

    /* =========================
       VALIDATE
    ========================= */

    const error =
      validateProductPayload(
        body
      );

    log(
  "VALIDATION_RESULT",
  {
    valid: !error,
    variantCount:
      body.variants?.length ?? 0,
  }
);

    if (error) {
      logError(
  "VALIDATION_FAILED",
  error
);

      return { error };
    }

    /* =========================
       VARIANTS
    ========================= */

    const variants =
      normalizeVariants(
        body.variants ?? []
      );

    log(
  "VARIANTS_NORMALIZED",
  {
    count:
      variants.length,
  }
);

    const hasVariants =
      variants.length > 0;

    /* =========================
       PRODUCT FIELDS
    ========================= */

    const {
      price,
      stock,
    } = buildProductFields(
      body,
      hasVariants
    );

    const {
      sale_enabled,
      sale_price,
      sale_stock,
      sale_start,
      sale_end,
    } = buildSaleFields(
      body,
      hasVariants
    );

    log(
  "CREATE_DB_READY",
  {
    hasVariants,
    variantCount:
      variants.length,
  }
);
    /* =========================
       CREATE PRODUCT
    ========================= */

    const product =
      await createProduct(
        userId,
        {
          name:
            body.name,

          description:
            body.description ??
            "",

          detail:
            body.detail ??
            "",

          images:
            body.images ??
            [],

          thumbnail:
            body.thumbnail ??
            "",

          category_id:
            getCategoryId(
              body
            ),

          price,
          stock,

          sale_enabled,
          sale_price,
          sale_stock,
          sale_start,
          sale_end,

          is_active:
            body.is_active !==
            false,

          has_variants:
            hasVariants,
        }
      );

    log(
  "CREATE_SUCCESS",
  {
    productId:
      maskId(product.id),
  }
);

    /* =========================
       VARIANTS SAVE
    ========================= */

    if (
      variants.length > 0
    ) {
      log(
  "SAVE_VARIANTS_START",
  {
    productId:
      maskId(product.id),
    count:
      variants.length,
  }
);

      await replaceVariantsByProductId(
        product.id,
        variants
      );

      log(
  "SAVE_VARIANTS_DONE"
);
    }

    /* =========================
       SHIPPING
    ========================= */

    const cleanedRates =
      normalizeShippingRates(
        body,
        body.primary_shipping_country
      );

    log(
  "SHIPPING_READY",
  {
    count:
      cleanedRates.length,
  }
);

    if (
      cleanedRates.length > 0
    ) {
      await upsertShippingRates({
        productId:
          product.id,

        rates:
          cleanedRates,
      });

      log(
  "SHIPPING_SAVED",
  {
    productId:
      maskId(product.id),
  }
);
    }

    /* =========================
       SUCCESS
    ========================= */

    return {
      success: true,

      data: {
        id: product.id,
      },
    };
  } catch (error) {
    logError(
  "CREATE_ERROR",
  error
);

    return {
      error:
        error instanceof Error
          ? error.message
          : "UNKNOWN_ERROR",
    };
  }
}
