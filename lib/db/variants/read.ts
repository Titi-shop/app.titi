import { query } from "@/lib/db";

import type {
  ProductVariantDB,
} from "@/types/product";

import type {
  VariantRow,
} from "./types";

import {
  mapVariantToApp,
} from "./mapper";

/* =========================================================
   LOGGER
========================================================= */

function vlog(
  step: string,
  payload?: unknown
): void {

  console.log(
    `[DB][VARIANTS][${step}]`,
    payload ?? ""
  );

}

function maskId(
  value: string
): string {

  if (value.length <= 8) {

    return value;

  }

  return (
    value.slice(0, 4) +
    "..." +
    value.slice(-4)
  );

}

/* =========================================================
   GET VARIANTS BY PRODUCT
========================================================= */

export async function getVariantsByProductId(
  productId: string
) {

  if (!productId) {

    throw new Error(
      "INVALID_PRODUCT_ID"
    );

  }

  vlog(
    "GET_BY_PRODUCT_START",
    {
      productId:
        maskId(
          productId
        ),
    }
  );

  const result =
    await query<ProductVariantDB>(
      `
      SELECT *
      FROM product_variants
      WHERE product_id = $1
        AND deleted_at IS NULL
      ORDER BY
        sort_order ASC,
        created_at ASC
      `,
      [productId]
    );

  const mapped =
    result.rows.map(
      mapVariantToApp
    );

  vlog(
    "GET_BY_PRODUCT_DONE",
    {
      count:
        mapped.length,
    }
  );

  return mapped;

}

/* =========================================================
   GET SINGLE VARIANT
========================================================= */

export async function getVariantById(
  variantId: string
): Promise<VariantRow | null> {

  vlog(
    "GET_VARIANT_START",
    {
      variantId:
        maskId(
          variantId
        ),
    }
  );

  const result =
    await query<VariantRow>(
      `
      SELECT
        id,
        product_id,
        price,
        sale_price,
        final_price,
        stock,
        is_unlimited,
        is_active
      FROM product_variants
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [variantId]
    );

  const row =
    result.rows[0] ?? null;

  if (!row) {

    vlog(
      "GET_VARIANT_DONE",
      {
        found: false,
      }
    );

    return null;

  }

  if (
    Number(
      row.final_price
    ) <= 0
  ) {

    throw new Error(
      "VARIANT_FINAL_PRICE_INVALID"
    );

  }

  vlog(
    "GET_VARIANT_DONE",
    {
      found: true,
    }
  );

  return row;

}

/* =========================================================
   VALIDATE OWNERSHIP
========================================================= */

export async function validateVariantOwnership(
  variantId: string,
  productId: string
): Promise<boolean> {

  const variant =
    await getVariantById(
      variantId
    );

  if (!variant) {

    return false;

  }

  return (
    variant.is_active &&
    variant.product_id ===
      productId
  );

}
