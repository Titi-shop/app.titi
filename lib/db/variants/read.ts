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
    `🧪 [DB][VARIANTS] ${step}`,
    payload ?? ""
  );
}

/* =========================================================
   GET VARIANTS BY PRODUCT
========================================================= */

export async function getVariantsByProductId(
  productId: string
) {
  vlog(
    "GET_BY_PRODUCT_START",
    {
      productId,
    }
  );

  if (!productId) {
    throw new Error(
      "INVALID_PRODUCT_ID"
    );
  }

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

  vlog(
    "GET_BY_PRODUCT_ROWS",
    result.rows.length
  );

  return result.rows.map(
    mapVariantToApp
  );
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
      variantId,
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
    "GET_VARIANT_RESULT",
    row
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
