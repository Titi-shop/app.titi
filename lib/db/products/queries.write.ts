import {
  query,
  withTransaction,
} from "@/lib/db";

import {
  isUUID,
  log,
  logError,
  maskId,
} from "./helpers";

/* =========================================================
   DELETE PRODUCT
========================================================= */

export async function deleteProductBySeller(
  seller_id: string,
  product_id: string
): Promise<boolean> {
  log(
  "DELETE_START",
  {
    sellerId:
      maskId(seller_id),

    productId:
      maskId(product_id),
  }
);

  try {
    if (
      !isUUID(seller_id) ||
      !isUUID(product_id)
    ) {
      return false;
    }

    const result =
      await query<{
        id: string;
      }>(
        `
        DELETE FROM products
        WHERE id = $1
          AND seller_id = $2
        RETURNING id
        `,
        [
          product_id,
          seller_id,
        ]
      );

    const success =
  result.rowCount === 1;

    log(
  "DELETE_SUCCESS",
  {
    productId:
      maskId(product_id),

    deleted:
      success,
  }
);

    return success;
  } catch (error) {
    logError(
      "DELETE_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   DELETE PRODUCT FULL
========================================================= */

export async function deleteProductById(
  product_id: string,
  seller_id: string
): Promise<{
  ok: boolean;
}> {
  log(
  "DELETE_FULL_START",
  {
    productId:
      maskId(product_id),

    sellerId:
      maskId(seller_id),
  }
);

  try {
    return await withTransaction(
    async (client) => {
      await client.query(
        `
        DELETE FROM product_variants
        WHERE product_id = $1
        `,
        [product_id]
      );

      await client.query(
        `
        DELETE FROM shipping_rates
        WHERE product_id = $1
        `,
        [product_id]
      );

      await client.query(
        `
        DELETE FROM cart_items
        WHERE product_id = $1
        `,
        [product_id]
      );

      await client.query(
        `
        DELETE FROM favorites
        WHERE product_id = $1
        `,
        [product_id]
      );

      await client.query(
        `
        DELETE FROM product_reviews
        WHERE product_id = $1
        `,
        [product_id]
      );

      const result =
        await client.query<{
          id: string;
        }>(
          `
          DELETE FROM products
          WHERE id = $1
            AND seller_id = $2
          RETURNING id
          `,
          [
            product_id,
            seller_id,
          ]
        );

      const ok =
  result.rowCount === 1;

      log(
  "DELETE_FULL_SUCCESS",
  {
    productId:
      maskId(product_id),

    deleted:
      ok,
  }
);

      return { ok };
    }
  );
}
