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
   CONST
========================================================= */

const EMPTY_UUID =
  "00000000-0000-0000-0000-000000000000";

/* =========================================================
   HELPERS
========================================================= */

function isUUID(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function normalizeQuantity(
  value: unknown
): number {
  const quantity =
    typeof value === "number" &&
    Number.isFinite(value)
      ? Math.floor(value)
      : 1;

  if (quantity <= 0) {
    return 1;
  }

  if (quantity > 99) {
    return 99;
  }

  return quantity;
}

/* =========================================================
   GET CART
========================================================= */

export async function getCart(
  userId: string
): Promise<CartRow[]> {
  console.log(
    "[CART][GET] START",
    { userId }
  );

  if (!isUUID(userId)) {
    console.error(
      "[CART][GET] INVALID_USER_ID",
      { userId }
    );

    throw new Error(
      "INVALID_USER_ID"
    );
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

  console.log(
    "[CART][GET] DONE",
    {
      userId,
      count: rs.rows.length,
    }
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
  console.log(
    "[CART][DELETE] START",
    {
      userId,
      productId,
      variantId,
    }
  );

  if (!isUUID(userId)) {
    throw new Error(
      "INVALID_USER_ID"
    );
  }

  if (!isUUID(productId)) {
    throw new Error(
      "INVALID_PRODUCT_ID"
    );
  }

  const normalizedVariantId =
    variantId &&
    isUUID(variantId)
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

    AND COALESCE(
      variant_id,
      $4::uuid
    ) = COALESCE(
      $3::uuid,
      $4::uuid
    )
    `,
    [
      userId,
      productId,
      normalizedVariantId,
      EMPTY_UUID,
    ]
  );

  console.log(
    "[CART][DELETE] DONE",
    {
      userId,
      productId,
      variantId:
        normalizedVariantId,
    }
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
  console.log(
    "[CART][PATCH] START",
    {
      userId,
      productId,
      variantId,
      quantity,
    }
  );

  if (!isUUID(userId)) {
    throw new Error(
      "INVALID_USER_ID"
    );
  }

  if (!isUUID(productId)) {
    throw new Error(
      "INVALID_PRODUCT_ID"
    );
  }

  const normalizedVariantId =
    variantId &&
    isUUID(variantId)
      ? variantId
      : null;

  const normalizedQuantity =
    normalizeQuantity(quantity);

  if (normalizedQuantity <= 0) {
    console.log(
      "[CART][PATCH] DELETE_FLOW"
    );

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

    AND COALESCE(
      variant_id,
      $5::uuid
    ) = COALESCE(
      $3::uuid,
      $5::uuid
    )

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

  console.log(
    "[CART][PATCH] DONE",
    {
      userId,
      productId,
      variantId:
        normalizedVariantId,
      quantity:
        normalizedQuantity,
    }
  );
}

/* =========================================================
   UPSERT
========================================================= */

export async function upsertCartItems(
  userId: string,
  items: CartItemInput[]
): Promise<void> {
  console.log(
    "[CART][UPSERT] START",
    {
      userId,
      itemsCount: items.length,
    }
  );

  if (!isUUID(userId)) {
    throw new Error(
      "INVALID_USER_ID"
    );
  }

  if (!Array.isArray(items)) {
    throw new Error(
      "INVALID_ITEMS"
    );
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
    if (!item) {
      continue;
    }

    if (!isUUID(item.product_id)) {
      console.warn(
        "[CART][UPSERT] INVALID_PRODUCT_ID",
        item
      );

      continue;
    }

    const variantId =
      item.variant_id &&
      isUUID(item.variant_id)
        ? item.variant_id
        : null;

    const quantity =
      normalizeQuantity(
        item.quantity
      );

    const key = `${item.product_id}_${variantId ?? EMPTY_UUID}`;

    if (deduped.has(key)) {
      const existed =
        deduped.get(key);

      if (existed) {
        existed.quantity += quantity;

        if (
          existed.quantity > 99
        ) {
          existed.quantity = 99;
        }
      }
    } else {
      deduped.set(key, {
        product_id:
          item.product_id,
        variant_id:
          variantId,
        quantity,
      });
    }
  }

  const finalItems = Array.from(
    deduped.values()
  );

  console.log(
    "[CART][UPSERT] DEDUPED",
    {
      count:
        finalItems.length,
      finalItems,
    }
  );

  if (finalItems.length === 0) {
    console.warn(
      "[CART][UPSERT] EMPTY_AFTER_DEDUP"
    );

    return;
  }

  const productIds: string[] =
    [];

  const variantIds: (
    | string
    | null
  )[] = [];

  const quantities: number[] =
    [];

  for (const item of finalItems) {
    productIds.push(
      item.product_id
    );

    variantIds.push(
      item.variant_id
    );

    quantities.push(
      item.quantity
    );
  }

  console.log(
    "[CART][UPSERT] SQL_START",
    {
      productIds,
      variantIds,
      quantities,
    }
  );

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

      quantity,

      is_selected,
      is_available,

      stock_snapshot,

      price_snapshot,

      is_price_changed,
      is_out_of_stock,

      created_at,
      updated_at
    )

    SELECT
      $1,

      p.id,
      x.variant_id,

      p.seller_id,

      p.name,
      p.slug,

      COALESCE(
        p.thumbnail,
        ''
      ),

      COALESCE(
        p.images,
        '{}'
      ),

      p.price,

      COALESCE(
        p.sale_price,
        p.price
      ),

      'PI',

      x.quantity,

      true,

      p.is_active,

      p.stock,

      COALESCE(
        p.sale_price,
        p.price
      ),

      false,

      CASE
        WHEN p.is_unlimited = false
        AND p.stock <= 0
        THEN true
        ELSE false
      END,

      NOW(),
      NOW()

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
      variant_id
    )

    DO UPDATE SET
      quantity =
        EXCLUDED.quantity,

      unit_price =
        EXCLUDED.unit_price,

      final_price =
        EXCLUDED.final_price,

      stock_snapshot =
        EXCLUDED.stock_snapshot,

      price_snapshot =
        EXCLUDED.price_snapshot,

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

  console.log(
    "[CART][UPSERT] DONE",
    {
      userId,
      inserted:
        finalItems.length,
    }
  );
}
