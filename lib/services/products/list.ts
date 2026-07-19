
import {
  getAllProducts,
  getProductsByIds,
} from "@/lib/db/products";

import {
  log,
  logError,
  maskId,
} from "@/lib/db/products/helpers";

import {
  getVariantsByProductIds,
} from "@/lib/db/variants";

import {
  getShippingRatesByProducts,
} from "@/lib/db/shipping";

import type {
  ShippingRateInput,
} from "./types";
import { isSaleActive } from "@/lib/utils/sale";
/* =========================================================
   LIST PRODUCTS
========================================================= */

export async function listProductsService(
  req: Request
) {
  try {
    const { searchParams } =
      new URL(req.url);

    const ids =
  searchParams.get("ids");

const categoryId =
  searchParams.get("category_id");

    log(
  "LIST_REQUEST",
  {
    idsCount: ids
      ? ids.split(",").filter(Boolean).length
      : null,

    categoryId:
      categoryId
        ? maskId(categoryId)
        : null,
  }
);

    /* =========================
       LOAD PRODUCTS
    ========================= */

    const products = ids
      ? await getProductsByIds(
          ids
            .split(",")
            .filter(Boolean)
        )
      : await getAllProducts();

    log(
      "LIST_SUCCESS",
      {
        count:
          products.length,
      }
    );

    const productIds =
      products.map(
        (product) =>
          product.id
      );
const [
  allVariants,
  shippingRows,
] = await Promise.all([
  productIds.length > 0
    ? getVariantsByProductIds(
        productIds
      )
    : Promise.resolve([]),

  productIds.length > 0
    ? getShippingRatesByProducts(
        productIds
      )
    : Promise.resolve([]),
]);
    const variantMap =
  new Map<
    string,
    typeof allVariants
  >();

for (const variant of allVariants) {

  if (
    !variantMap.has(
      variant.product_id
    )
  ) {
    variantMap.set(
      variant.product_id,
      []
    );
  }

  variantMap
    .get(variant.product_id)!
    .push(variant);

}
    /* =========================
       SHIPPING
    ========================= */

    log(
      "SHIPPING_LOADED",
      {
        count:
          shippingRows.length,
      }
    );

    const shippingMap =
      new Map<
        string,
        ShippingRateInput[]
      >();

    for (const row of shippingRows) {
      if (
        !shippingMap.has(
          row.product_id
        )
      ) {
        shippingMap.set(
          row.product_id,
          []
        );
      }

      shippingMap
        .get(row.product_id)!
        .push({
          zone: row.zone,
          price: Number(
            row.price
          ),
          domestic_country_code:
            row.domestic_country_code,
        });
    }

    /* =========================
       ENRICH PRODUCTS
    ========================= */

    return products.map(
  (product) => {
          const hasVariants =
            product.has_variants ===
            true;

          /* =====================
             NO VARIANTS
          ===================== */

          if (!hasVariants) {
            const saleActive =
              isSaleActive(
                product.sale_enabled,
                product.sale_price,
                product.price,
                product.sale_start,
                product.sale_end
              );

            return {
              ...product,

              variants: [],
              min_price: null,
              max_price: null,

              sale_price:
                saleActive
                  ? product.sale_price
                  : null,

              final_price:
                saleActive
                  ? Number(
                      product.sale_price
                    )
                  : Number(
                      product.price
                    ),

              shipping_rates:
                shippingMap.get(
                  product.id
                ) ?? [],
            };
          }

          /* =====================
             LOAD VARIANTS
          ===================== */

          const variants =
  variantMap.get(
    product.id
  ) ?? [];

          if (
  process.env.NODE_ENV ===
  "development"
) {
  log(
    "VARIANTS_LOADED",
    {
      productId:
        maskId(product.id),
      variantCount:
        variants.length,
    }
  );
}

          const enrichedVariants =
            variants.map(
              (variant) => {
                const saleActive =
                  isSaleActive(
                    variant.sale_enabled,
                    variant.sale_price,
                    variant.price,
                    product.sale_start,
                    product.sale_end
                  );

                return {
                  ...variant,

                  sale_enabled:
                    saleActive,

                  sale_price:
                    saleActive
                      ? variant.sale_price
                      : null,

                  final_price:
                    saleActive
                      ? Number(
                          variant.sale_price
                        )
                      : Number(
                          variant.price
                        ),
                };
              }
            );

          const prices =
            enrichedVariants.map(
              (v) =>
                Number(
                  v.final_price
                )
            );

          const saleVariants =
            enrichedVariants.filter(
              (v) =>
                v.sale_enabled
            );

          if (
  process.env.NODE_ENV ===
  "development"
) {
  log(
    "VARIANT_SUMMARY",
    {
      productId:
        maskId(product.id),
      variantCount:
        enrichedVariants.length,
    }
  );
}

          return {
            ...product,

            price: Math.min(
              ...enrichedVariants.map(
                (v) =>
                  Number(
                    v.price
                  )
              )
            ),

            sale_price:
              saleVariants.length >
              0
                ? Math.min(
                    ...saleVariants.map(
                      (v) =>
                        Number(
                          v.sale_price
                        )
                    )
                  )
                : null,

            final_price:
              Math.min(
                ...prices
              ),

            has_variants:
              true,

            min_price:
              Math.min(
                ...prices
              ),

            max_price:
              Math.max(
                ...prices
              ),

            variants:
              enrichedVariants,

            shipping_rates:
              shippingMap.get(
                product.id
              ) ?? [],
          };
        });
  } catch (error) {
    logError(
      "LIST_ERROR",
      error
    );

    throw error;
  }
}
