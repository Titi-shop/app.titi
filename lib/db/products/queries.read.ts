import { query } from "@/lib/db";

import type {
  ProductRow,
  ProductRecord,
} from "@/types/Product";

import {
  isUUID,
  log,
  logError,
  maskId,
} from "./helpers";

import {
  mapRow,
} from "./mapper";


/* =========================================================
   GET ALL PRODUCTS
========================================================= */

export async function getAllProducts(
  limit = 20
): Promise<ProductRecord[]> {
  log(
    "GET_ALL_START",
    { limit }
  );

  try {
    const { rows } =
      await query<ProductRow>(
        `
        SELECT
  p.*,

  (
    SELECT COUNT(*)
    FROM product_favorites pf
    WHERE pf.product_id = p.id
  )::int AS favorite_count
FROM products p
WHERE p.deleted_at IS NULL
ORDER BY p.created_at DESC
LIMIT $1
        `,
        [limit]
      );

    log(
      "GET_ALL_SUCCESS",
      {
        count:
          rows.length,
      }
    );

    return rows.map(
      mapRow
    );
  } catch (error) {
    logError(
      "GET_ALL_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   GET PRODUCT BY ID
========================================================= */

export async function getProductById(
  productId: string,
  userId: string | null
): Promise<ProductRecord | null> {
  log("GET_BY_ID_START", {
    productId: maskId(productId),
  });

  try {
    if (!productId || !isUUID(productId)) {
      log("GET_BY_ID_INVALID_ID", {
        productId,
      });

      return null;
    }

    const { rows } = await query<ProductRow>(
      `
      SELECT
        p.*,

        (
          SELECT COUNT(*)
          FROM product_favorites pf
          WHERE pf.product_id = p.id
        )::int AS favorite_count,

        COALESCE(
          EXISTS (
            SELECT 1
            FROM product_favorites pf
            WHERE pf.product_id = p.id
              AND pf.user_id = $2
          ),
          FALSE
        ) AS is_favorite

      FROM products p

      WHERE p.id = $1
        AND p.deleted_at IS NULL

      LIMIT 1
      `,
      [
        productId,
        userId,
      ]
    );

    const row = rows[0] ?? null;

    if (!row) {
      log("GET_BY_ID_NOT_FOUND", {
        productId: maskId(productId),
      });

      return null;
    }

    const product = mapRow(row);

    log("GET_BY_ID_SUCCESS", {
      productId: maskId(productId),
    });

    return product;
  } catch (error) {
    logError("GET_BY_ID_ERROR", error);

    throw error;
  }
}

/* =========================================================
   GET PRODUCTS BY IDS
========================================================= */

export async function getProductsByIds(
  ids: string[]
): Promise<ProductRecord[]> {
  log(
  "GET_BY_IDS_START",
  {
    count:
      ids.length,
  }
);

  try {
    if (
      !Array.isArray(ids)
    ) {
      throw new Error(
        "INVALID_PRODUCT_IDS"
      );
    }

    const validIds =
      ids.filter(isUUID);

    if (
      validIds.length === 0
    ) {
      log(
        "GET_BY_IDS_EMPTY"
      );

      return [];
    }

    const result =
      await query<ProductRow>(
        `
        SELECT *
        FROM products
        WHERE id = ANY($1::uuid[])
          AND deleted_at IS NULL
        `,
        [validIds]
      );

    log(
      "GET_BY_IDS_SUCCESS",
      {
        count:
          result.rows.length,
      }
    );

    return result.rows.map(
      mapRow
    );
  } catch (error) {
    logError(
      "GET_BY_IDS_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   GET SELLER PRODUCTS
========================================================= */

export async function getSellerProducts(
  seller_id: string
): Promise<ProductRecord[]> {
  log(
    "GET_SELLER_PRODUCTS_START",
   {
  sellerId:
    maskId(seller_id),
}
  );

  try {
    if (!isUUID(seller_id)) {
      return [];
    }

    const result =
      await query<ProductRow>(
        `
        SELECT
  p.*,

  MIN(
    COALESCE(
      pv.final_price,
      pv.sale_price,
      pv.price
    )
  ) AS min_price,

  MIN(
    CASE
      WHEN pv.sale_enabled = true
      THEN pv.sale_price
      ELSE NULL
    END
  ) AS min_sale_price,

  up.shop_name,
  up.shop_banner,
  up.avatar_url,
  up.total_sales,
  up.shop_description

FROM products p

LEFT JOIN product_variants pv
  ON pv.product_id = p.id
 AND pv.deleted_at IS NULL

LEFT JOIN user_profiles up
  ON up.user_id = p.seller_id

WHERE p.seller_id = $1
  AND p.deleted_at IS NULL

GROUP BY
  p.id,
  up.shop_name,
  up.shop_banner,
  up.avatar_url,
  up.total_sales,
  up.shop_description

ORDER BY p.created_at DESC
        `,
        [seller_id]
      );

    log(
  "GET_SELLER_PRODUCTS_SUCCESS",
  {
    count:
      result.rows.length,
  }
);

    return result.rows.map(
      mapRow
    );
  } catch (error) {
    logError(
      "GET_SELLER_PRODUCTS_ERROR",
      error
    );

    throw error;
  }
}
/* =========================================================
   GET PRODUCTS BY CATEGORY
========================================================= */

export async function getProductsByCategory(
  categoryId: string,
  limit = 10
): Promise<ProductRecord[]> {

  log(
    "GET_BY_CATEGORY_START",
    {
      categoryId: maskId(categoryId),
      limit,
    }
  );

  try {
    const result =
      await query<ProductRow>(
        `
        SELECT *
        FROM products
        WHERE category_id = $1
          AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT $2
        `,
        [
          categoryId,
          limit,
        ]
      );

    log(
      "GET_BY_CATEGORY_SUCCESS",
      {
        count:
          result.rows.length,
      }
    );

    return result.rows.map(
      mapRow
    );

  } catch (error) {

    logError(
      "GET_BY_CATEGORY_ERROR",
      error
    );

    throw error;
  }
}
