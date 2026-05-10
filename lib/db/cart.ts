// lib/db/cart.ts

import { query } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

export type CartItemInput = {
  product_id: string;
  variant_id?: string | null;
  quantity?: number;
};

export type CartRow = {
  product_id: string;
  variant_id: string | null;

  quantity: number;

  price: string;
  sale_price: string;

  is_price_changed: boolean;
  is_out_of_stock: boolean;

  name: string;
  slug: string;

  thumbnail: string;

  images: string[];
};

/* =========================================================
   HELPERS
========================================================= */

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

function isUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function normalizeQuantity(value: unknown): number {
  const quantity =
    typeof value === "number" &&
    Number.isFinite(value)
      ? Math.floor(value)
      : 1;

  if (quantity <= 0) return 1;
  if (quantity > 99) return 99;

  return quantity;
}

/* =========================================================
   GET CART
========================================================= */

export async function getCart(
  userId: string
): Promise<CartRow[]> {
  if (!isUUID(userId)) {
    throw new Error("INVALID_USER_ID");
  }

  const rs = await query<CartRow>(
    `
    SELECT
      c.product_id,
      c.variant_id,

      c.quantity,

      c.unit_price::text AS price,
      c.final_price::text AS sale_price,

      c.is_price_changed,
      c.is_out_of_stock,

      c.product_name AS name,
      c.product_slug AS slug,

      c.thumbnail,

      c.images

    FROM cart_items c

    WHERE c.user_id = $1
    AND c.deleted_at IS NULL

    ORDER BY c.created_at DESC
    `,
    [userId]
  );

  return rs.rows;
}

/* =========================================================
   DELETE ITEM
========================================================= */

export async function deleteCartItem(
  userId: string,
  productId: string,
  variantId?: string | null
): Promise<void> {
  if (!isUUID(userId)) {
    throw new Error("INVALID_USER_ID");
  }

  if (!isUUID(productId)) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  const normalizedVariantId =
    variantId && isUUID(variantId)
      ? variantId
      : null;

  await query(
    `
    UPDATE cart_items
    SET
      deleted_at = NOW(),
      updated_at = NOW()

    WHERE user_id = $1
    AND product_id = $2
    AND variant_key = COALESCE($3, $4::uuid)
    `,
    [
      userId,
      productId,
      normalizedVariantId,
      EMPTY_UUID,
    ]
  );
}

/* =========================================================
   UPDATE QUANTITY
========================================================= */

export async function updateCartItemQuantity(
  userId: string,
  productId: string,
  variantId: string | null,
  quantity: number
): Promise<void> {
  if (!isUUID(userId)) {
    throw new Error("INVALID_USER_ID");
  }

  if (!isUUID(productId)) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  const normalizedVariantId =
    variantId && isUUID(variantId)
      ? variantId
      : null;

  const normalizedQuantity =
    normalizeQuantity(quantity);

  if (normalizedQuantity <= 0) {
    return deleteCartItem(
      userId,
      productId,
      normalizedVariantId
    );
  }

  await query(
    `
    UPDATE cart_items
    SET
      quantity = $4,
      updated_at = NOW()

    WHERE user_id = $1
    AND product_id = $2
    AND variant_key = COALESCE($3, $5::uuid)
    AND deleted_at IS NULL
    `,
    [
      userId,
      productId,
      normalizedVariantId,
      normalizedQuantity,
      EMPTY_UUID,
    ]
  );
}

/* =========================================================
   UPSERT CART ITEMS
========================================================= */

export async function upsertCartItems(
  userId: string,
  items: CartItemInput[]
): Promise<void> {
  if (!isUUID(userId)) {
    throw new Error("INVALID_USER_ID");
  }

  if (!Array.isArray(items)) {
    throw new Error("INVALID_ITEMS");
  }

  const deduped = new Map<
    string,
    {
      product_id: string;
      variant_id: string | null;
      quantity: number;
    }
  >();

  for (const item of items) {
    if (!item) continue;

    if (!isUUID(item.product_id)) {
      continue;
    }

    const variantId =
      item.variant_id && isUUID(item.variant_id)
        ? item.variant_id
        : null;

    const quantity = normalizeQuantity(
      item.quantity
    );

    const key = `${item.product_id}_${variantId ?? EMPTY_UUID}`;

    if (deduped.has(key)) {
      const existed = deduped.get(key);

      if (existed) {
        existed.quantity += quantity;

        if (existed.quantity > 99) {
          existed.quantity = 99;
        }
      }
    } else {
      deduped.set(key, {
        product_id: item.product_id,
        variant_id: variantId,
        quantity,
      });
    }
  }

  const finalItems = Array.from(
    deduped.values()
  );

  if (finalItems.length === 0) {
    return;
  }

  const productIds: string[] = [];
  const variantIds: (string | null)[] = [];
  const quantities: number[] = [];

  for (const item of finalItems) {
    productIds.push(item.product_id);

    variantIds.push(item.variant_id);

    quantities.push(item.quantity);
  }

  await query(
    `
    INSERT INTO cart_items (
      user_id,

      product_id,
      variant_id,
      seller_id,

      product_name,
      product_slug,

      thumbnail,
      images,

      unit_price,
      final_price,
      currency,

      price_snapshot,

      quantity,

      is_selected,
      is_available,
      is_unlimited,

      is_price_changed,
      is_out_of_stock,

      stock_snapshot,

      created_at,
      updated_at,
      deleted_at
    )

    SELECT
      $1,

      p.id,
      x.variant_id,

      p.seller_id,

      p.name,
      p.slug,

      COALESCE(p.thumbnail, ''),

      COALESCE(p.images, '{}'),

      p.price,

      COALESCE(
        p.sale_price,
        p.price
      ),

      'PI',

      COALESCE(
        p.sale_price,
        p.price
      ),

      x.quantity,

      true,

      true,

      COALESCE(
        p.unlimited_stock,
        false
      ),

      false,

      CASE
        WHEN COALESCE(p.stock, 0) <= 0
        AND COALESCE(
          p.unlimited_stock,
          false
        ) = false
        THEN true
        ELSE false
      END,

      p.stock,

      NOW(),
      NOW(),
      NULL

    FROM UNNEST(
      $2::uuid[],
      $3::uuid[],
      $4::int[]
    ) AS x(
      product_id,
      variant_id,
      quantity
    )

    JOIN products p
      ON p.id = x.product_id

    ON CONFLICT (
      user_id,
      product_id,
      variant_key
    )

    DO UPDATE SET
      quantity = EXCLUDED.quantity,

      unit_price = EXCLUDED.unit_price,

      final_price = EXCLUDED.final_price,

      price_snapshot =
        EXCLUDED.price_snapshot,

      stock_snapshot =
        EXCLUDED.stock_snapshot,

      is_out_of_stock =
        EXCLUDED.is_out_of_stock,

      is_price_changed =
        cart_items.final_price
        IS DISTINCT FROM
        EXCLUDED.final_price,

      deleted_at = NULL,

      updated_at = NOW()
    `,
    [
      userId,
      productIds,
      variantIds,
      quantities,
    ]
  );
}
