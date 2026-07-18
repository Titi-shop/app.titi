import { query } from "@/lib/db";

export type ProductFavoriteRow = {
  id: string;
  product_id: string;
  user_id: string;
  created_at: string;
};
export async function isProductFavorited(
  userId: string,
  productId: string
): Promise<boolean> {
  const res = await query(
    `
    SELECT 1
    FROM product_favorites
    WHERE user_id = $1
      AND product_id = $2
    LIMIT 1
    `,
    [userId, productId]
  );

  return res.rows.length > 0;
}
export async function countProductFavorites(
  productId: string
): Promise<number> {
  const res = await query<{
    count: string;
  }>(
    `
    SELECT COUNT(*)::text AS count
    FROM product_favorites
    WHERE product_id = $1
    `,
    [productId]
  );

  return Number(res.rows[0]?.count ?? 0);
}
export async function toggleProductFavorite(
  userId: string,
  productId: string
) {
  const exists = await isProductFavorited(
    userId,
    productId
  );

  if (exists) {
    await query(
      `
      DELETE
      FROM product_favorites
      WHERE user_id = $1
        AND product_id = $2
      `,
      [userId, productId]
    );

    return {
      favorited: false,
    };
  }

  const insert =
    await query<ProductFavoriteRow>(
      `
      INSERT INTO product_favorites
      (
        user_id,
        product_id
      )
      VALUES ($1,$2)
      RETURNING *
      `,
      [userId, productId]
    );

  return {
    favorited: true,
    favorite: insert.rows[0],
  };
}

export async function getFavoriteProductsByUser(
  userId: string
) {
  const res = await query(
    `
    SELECT
      p.*
    FROM product_favorites pf
    JOIN products p
      ON p.id = pf.product_id
    WHERE pf.user_id = $1
      AND p.deleted_at IS NULL
    ORDER BY pf.created_at DESC
    `,
    [userId]
  );

  return res.rows;
}
