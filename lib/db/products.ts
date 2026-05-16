import { query, withTransaction } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

export type ProductStatus =
  | "draft"
  | "active"
  | "inactive"
  | "archived"
  | "banned";

export type ProductRow = {
  id: string;
  seller_id: string;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  detail: string;
  thumbnail: string;
  images: string[];
  detail_images: string[];
  video_url: string;
  price: number;
  sale_price: number | null;
  final_price: number;
  currency: "PI";
  stock: number;
  is_unlimited: boolean;
  sold: number;
  views: number;
  rating_avg: number;
  rating_count: number;
  is_active: boolean;
  is_featured: boolean;
  is_digital: boolean;
  status: ProductStatus;
  category_id: number | null;
  sale_start: string | null;
  sale_end: string | null;
  sale_enabled: boolean;
  sale_stock: number;
  sale_sold: number;
  meta_title: string;
  meta_description: string;
  has_variants: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ProductRecord = ProductRow;
export type CreateProductInput = {
  name: string;
  short_description?: string;
  description?: string;
  detail?: string;
  thumbnail?: string;
  images?: string[];
  detail_images?: string[];
  video_url?: string;
  category_id?: number | null;
  price?: number;
  sale_price?: number | null;
  currency?: "PI";
  stock?: number;
  is_unlimited?: boolean;
  is_featured?: boolean;
  is_digital?: boolean;
  sale_start?: string | null;
  sale_end?: string | null;
  sale_enabled?: boolean;
  sale_stock?: number;
  meta_title?: string;
  meta_description?: string;
  status?: ProductStatus;
  is_active?: boolean;
  has_variants?: boolean;
};

export type UpdateProductInput =
  Partial<CreateProductInput>;

/* =========================================================
   LOGGER
========================================================= */

function log(
  step: string,
  data?: unknown
) {
  console.log(
    `🧪 [DB][PRODUCTS][V2] ${step}`,
    data ?? ""
  );
}

/* =========================================================
   HELPERS
========================================================= */

function isUUID(
  value: string
): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(
    value
  );
}

function safeNumber(
  value: unknown,
  fallback = 0
): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

function safeNullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

function normalizeImages(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === "string" &&
      item.trim().length > 0
  );
}

function slugify(
  value: string
): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeStatus(
  status?: ProductStatus,
  isActive?: boolean
): ProductStatus {
  if (status) {
    return status;
  }

  return isActive === false
    ? "inactive"
    : "active";
}

function calcFinalPrice(
  data: {
    price?: number;
    sale_price?: number | null;
    sale_enabled?: boolean;
    sale_start?: string | null;
    sale_end?: string | null;
  }
): number {
  const price = safeNumber(
    data.price
  );

  const salePrice =
    safeNullableNumber(
      data.sale_price
    );

  if (!data.sale_enabled) {
    return price;
  }

  if (
    salePrice === null ||
    salePrice <= 0
  ) {
    return price;
  }

  if (salePrice >= price) {
    return price;
  }

  return salePrice;
}

function mapRow(
  row: ProductRow
): ProductRecord {
  return {
    ...row,

    price: safeNumber(row.price),

    sale_price:
      safeNullableNumber(
        row.sale_price
      ),

    final_price: safeNumber(
      row.final_price
    ),

    stock: safeNumber(row.stock),

    sale_stock: safeNumber(
      row.sale_stock
    ),

    sale_sold: safeNumber(
      row.sale_sold
    ),

    sold: safeNumber(row.sold),

    views: safeNumber(row.views),

    rating_avg: safeNumber(
      row.rating_avg
    ),

    rating_count: safeNumber(
      row.rating_count
    ),

    images: normalizeImages(
      row.images
    ),

    detail_images:
      normalizeImages(
        row.detail_images
      ),

    is_active:
      row.is_active !== false,

    is_featured:
      row.is_featured === true,

    is_digital:
      row.is_digital === true,

    is_unlimited:
      row.is_unlimited === true,

    sale_enabled:
      row.sale_enabled === true,

    has_variants:
      row.has_variants === true,
  };
}

/* =========================================================
   GET ALL
========================================================= */

export async function getAllProducts(
  limit = 20
): Promise<ProductRecord[]> {
  log("GET_ALL_START", {
    limit,
  });

  const result =
    await query<ProductRow>(
      `
      SELECT *
      FROM products
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit]
    );

  return result.rows.map(mapRow);
}


/* =====================================================
   GET PRODUCT BY ID
===================================================== */
export async function getProductById(
  productId: string
): Promise<ProductRecord | null> {
  console.log(
    "\n🚀 [PRODUCTS][GET_BY_ID] ===== START ====="
  );

  try {
    console.log(
      "📥 Incoming productId:",
      productId
    );

    log("GET_BY_ID_START", {
      productId,
    });

    if (!productId) {
      console.error(
        "❌ Missing productId"
      );

      return null;
    }

    console.log(
      "🔍 Validating UUID..."
    );

    if (!isUUID(productId)) {
      console.error(
        "❌ INVALID_PRODUCT_ID:",
        productId
      );

      return null;
    }

    console.log(
      "✅ UUID valid"
    );

    const sql = `
      SELECT *
      FROM products
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `;

    console.log(
      "📜 SQL:",
      sql
    );

    console.log(
      "📦 SQL PARAMS:",
      [productId]
    );

    console.log(
      "🗄️ Executing product query..."
    );

    const result =
      await query<ProductRow>(
        sql,
        [productId]
      );

    console.log(
      "✅ Query success"
    );

    console.log(
      "📊 Rows count:",
      result.rows.length
    );

    console.log(
      "📦 RAW PRODUCT ROWS:",
      result.rows
    );

    const row =
      result.rows[0] ?? null;

    console.log(
      "🎯 Selected row:",
      row
    );

    if (!row) {
      console.warn(
        "⚠️ PRODUCT_NOT_FOUND"
      );

      console.log(
        "🏁 [PRODUCTS][GET_BY_ID] RETURN NULL\n"
      );

      return null;
    }

    console.log(
      "🧩 Mapping database row..."
    );

    const mapped = mapRow(row);

    console.log(
      "✅ Mapped product:",
      mapped
    );

    console.log(
      "🏁 [PRODUCTS][GET_BY_ID] ===== SUCCESS =====\n"
    );

    return mapped;
  } catch (error) {
    console.error(
      "💥 [PRODUCTS][GET_BY_ID] ERROR:",
      error
    );

    throw error;
  }
}

/* =========================================================
   GET SELLER PRODUCTS
========================================================= */

export async function getSellerProducts(
  sellerId: string
): Promise<ProductRecord[]> {
  log("GET_SELLER_PRODUCTS", {
    sellerId,
  });

  if (!isUUID(sellerId)) {
    return [];
  }

  const result =
    await query<ProductRow>(
      `
      SELECT *
      FROM products
      WHERE seller_id = $1
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      `,
      [sellerId]
    );

  return result.rows.map(mapRow);
}

/* =========================================================
   CREATE PRODUCT
========================================================= */

export async function createProduct(
  sellerId: string,
  input: CreateProductInput
): Promise<ProductRecord> {
  log("CREATE_START", input);

  if (!isUUID(sellerId)) {
    throw new Error(
      "INVALID_SELLER_ID"
    );
  }

  const price = safeNumber(
    input.price
  );

  const salePrice =
    safeNullableNumber(
      input.sale_price
    );

  const finalPrice =
    calcFinalPrice({
      price,
      sale_price: salePrice,
      sale_enabled:
        input.sale_enabled,
    });

  const slug = slugify(
    input.name
  );

  const status =
    normalizeStatus(
      input.status,
      input.is_active
    );

  const result =
    await query<ProductRow>(
      `
      INSERT INTO products (
        seller_id,
        name,
        slug,
        short_description,
        description,
        detail,
        thumbnail,
        images,
        detail_images,
        video_url,
        price,
        sale_price,
        final_price,
        currency,
        stock,
        is_unlimited,
        is_featured,
        is_digital,
        status,
        category_id,
        sale_start,
        sale_end,
        sale_enabled,
        sale_stock,
        meta_title,
        meta_description,
        is_active,
        has_variants
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,
        $11,$12,$13,$14,
        $15,$16,$17,$18,
        $19,$20,$21,$22,
        $23,$24,$25,$26,
        $27,$28
      )
      RETURNING *
      `,
      [
        sellerId,
        input.name.trim(),
        slug,

        input.short_description ??
          "",

        input.description ?? "",

        input.detail ?? "",

        input.thumbnail ?? "",

        normalizeImages(
          input.images
        ),

        normalizeImages(
          input.detail_images
        ),

        input.video_url ?? "",

        price,

        salePrice,

        finalPrice,

        "PI",

        safeNumber(
          input.stock
        ),

        Boolean(
          input.is_unlimited
        ),

        Boolean(
          input.is_featured
        ),

        Boolean(
          input.is_digital
        ),

        status,

        input.category_id ??
          null,

        input.sale_start ??
          null,

        input.sale_end ??
          null,

        Boolean(
          input.sale_enabled
        ),

        safeNumber(
          input.sale_stock
        ),

        input.meta_title ?? "",

        input.meta_description ??
          "",

        input.is_active !==
          false,

        Array.isArray((input as any).variants) &&
(input as any).variants.length > 0,
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "FAILED_TO_CREATE_PRODUCT"
    );
  }

  log("CREATE_SUCCESS", row.id);

  return mapRow(row);
}

/* =========================================================
   UPDATE PRODUCT
========================================================= */

export async function updateProductBySeller(
  sellerId: string,
  productId: string,
  input: UpdateProductInput
): Promise<ProductRecord | null> {
  log("UPDATE_START", {
    sellerId,
    productId,
    input,
  });

  if (
    !isUUID(sellerId) ||
    !isUUID(productId)
  ) {
    return null;
  }

  const current =
    await getProductById(
      productId
    );

  if (!current) {
    return null;
  }

  const nextPrice =
    input.price !== undefined
      ? safeNumber(input.price)
      : current.price;

  const nextSalePrice =
    input.sale_price !== undefined
      ? safeNullableNumber(
          input.sale_price
        )
      : current.sale_price;

  const nextSaleEnabled =
    input.sale_enabled !==
    undefined
      ? Boolean(
          input.sale_enabled
        )
      : current.sale_enabled;

  const nextFinalPrice =
    calcFinalPrice({
      price: nextPrice,
      sale_price:
        nextSalePrice,
      sale_enabled:
        nextSaleEnabled,
    });

  const nextStatus =
    normalizeStatus(
      input.status,
      input.is_active
    );

  const result =
    await query<ProductRow>(
      `
      UPDATE products
      SET
        name = $1,
        slug = $2,
        short_description = $3,
        description = $4,
        detail = $5,
        thumbnail = $6,
        images = $7,
        detail_images = $8,
        video_url = $9,
        price = $10,
        sale_price = $11,
        final_price = $12,
        stock = $13,
        is_unlimited = $14,
        is_featured = $15,
        is_digital = $16,
        status = $17,
        category_id = $18,
        sale_start = $19,
        sale_end = $20,
        sale_enabled = $21,
        sale_stock = $22,
        meta_title = $23,
        meta_description = $24,
        is_active = $25,
        has_variants = $26,
        updated_at = NOW()
      WHERE id = $27
        AND seller_id = $28
        AND deleted_at IS NULL
      RETURNING *
      `,
      [
        input.name?.trim() ??
          current.name,

        slugify(
          input.name ??
            current.name
        ),

        input.short_description ??
          current.short_description,

        input.description ??
          current.description,

        input.detail ??
          current.detail,

        input.thumbnail ??
          current.thumbnail,

        input.images
          ? normalizeImages(
              input.images
            )
          : current.images,

        input.detail_images
          ? normalizeImages(
              input.detail_images
            )
          : current.detail_images,

        input.video_url ??
          current.video_url,
        nextPrice,
        nextSalePrice,
        nextFinalPrice,

        input.stock !==
        undefined
          ? safeNumber(
              input.stock
            )
          : current.stock,

        input.is_unlimited !==
        undefined
          ? Boolean(
              input.is_unlimited
            )
          : current.is_unlimited,

        input.is_featured !==
        undefined
          ? Boolean(
              input.is_featured
            )
          : current.is_featured,

        input.is_digital !==
        undefined
          ? Boolean(
              input.is_digital
            )
          : current.is_digital,

        nextStatus,

        input.category_id !==
        undefined
          ? input.category_id
          : current.category_id,

        input.sale_start !==
        undefined
          ? input.sale_start
          : current.sale_start,

        input.sale_end !==
        undefined
          ? input.sale_end
          : current.sale_end,

        nextSaleEnabled,

        input.sale_stock !==
        undefined
          ? safeNumber(
              input.sale_stock
            )
          : current.sale_stock,

        input.meta_title ??
          current.meta_title,

        input.meta_description ??
          current.meta_description,

        input.is_active !==
        undefined
          ? input.is_active
          : current.is_active,

        Array.isArray((input as any).variants)
       ? (input as any).variants.length > 0
        : current.has_variants,

        productId,
        sellerId,
      ]
    );

  const row =
    result.rows[0] ?? null;

  if (!row) {
    return null;
  }

  log("UPDATE_SUCCESS", row.id);

  return mapRow(row);
}

/* =========================================================
   SOFT DELETE
========================================================= */

export async function deleteProductBySeller(
  sellerId: string,
  productId: string
): Promise<boolean> {
  log("DELETE_HARD_START", {
    sellerId,
    productId,
  });

  if (!isUUID(sellerId) || !isUUID(productId)) {
    return false;
  }

  const result = await query(
    `
    DELETE FROM products
    WHERE id = $1
      AND seller_id = $2
    RETURNING id
    `,
    [productId, sellerId]
  );

  return result.rows.length > 0;
}

/* =========================================================
   INCREMENT VIEW
========================================================= */

export async function incrementProductView(
  productId: string
): Promise<number> {
  const result =
    await query<{
      views: number;
    }>(
      `
      UPDATE products
      SET
        views = views + 1,
        updated_at = NOW()
      WHERE id = $1
      RETURNING views
      `,
      [productId]
    );

  return safeNumber(
    result.rows[0]?.views
  );
}
/* =====================================================
   GET PRODUCTS BY IDS
===================================================== */
export async function getProductsByIds(
  ids: string[]
) {
  console.log(
    "\n🚀 [PRODUCTS][GET_BY_IDS] ===== START ====="
  );

  try {
    console.log(
      "📥 Incoming ids:",
      ids
    );

    console.log(
      "📊 Total ids:",
      ids?.length ?? 0
    );

    if (!Array.isArray(ids)) {
      console.error(
        "❌ ids is not array"
      );

      throw new Error(
        "INVALID_PRODUCT_IDS"
      );
    }

    if (!ids.length) {
      console.warn(
        "⚠️ Empty ids array"
      );

      console.log(
        "🏁 [PRODUCTS][GET_BY_IDS] RETURN EMPTY ARRAY\n"
      );

      return [];
    }

    console.log(
      "🗄️ Executing database query..."
    );

    const sql = `
      SELECT *
      FROM products
      WHERE id = ANY($1::uuid[])
    `;

    console.log(
      "📜 SQL:",
      sql
    );

    console.log(
      "📦 SQL PARAMS:",
      [ids]
    );

    const { rows } = await query(
      sql,
      [ids]
    );

    console.log(
      "✅ Query success"
    );

    console.log(
      "📊 Rows count:",
      rows.length
    );

    console.log(
      "📦 Rows data:",
      rows
    );

    console.log(
      "🏁 [PRODUCTS][GET_BY_IDS] ===== SUCCESS =====\n"
    );

    return rows;
  } catch (error) {
    console.error(
      "💥 [PRODUCTS][GET_BY_IDS] ERROR:",
      error
    );

    throw error;
  }
}
export async function deleteProductById(
  productId: string,
  sellerId: string
) {
  return withTransaction(async (client) => {

    // variants
    await client.query(
      `
      DELETE FROM product_variants
      WHERE product_id = $1
      `,
      [productId]
    );

    // shipping
    await client.query(
      `
      DELETE FROM shipping_rates
      WHERE product_id = $1
      `,
      [productId]
    );

    // cart
    await client.query(
      `
      DELETE FROM cart_items
      WHERE product_id = $1
      `,
      [productId]
    );

    // wishlist
    await client.query(
      `
      DELETE FROM favorites
      WHERE product_id = $1
      `,
      [productId]
    );

    // reviews
    await client.query(
      `
      DELETE FROM product_reviews
      WHERE product_id = $1
      `,
      [productId]
    );

    // cuối cùng mới xóa product
    const result = await client.query(
      `
      DELETE FROM products
      WHERE id = $1
        AND seller_id = $2
      RETURNING id
      `,
      [productId, sellerId]
    );

    return {
      ok: result.rows.length > 0,
    };
  });
}
export async function getSoldByProduct(productId: string) {
  const { rows } = await query(
    `
    SELECT COALESCE(SUM(quantity), 0) as sold
    FROM order_items
    WHERE product_id = $1
    `,
    [productId]
  );

  return Number(rows[0]?.sold || 0);
}
/* =========================================================
   RECALCULATE PRODUCT FROM VARIANTS
========================================================= */

export async function syncProductFromVariants(
  productId: string
): Promise<void> {
  await withTransaction(
    async (client) => {
      log(
        "SYNC_FROM_VARIANTS",
        productId
      );

      const result =
        await client.query<{
          min_price: number;
          total_stock: number;
        }>(
          `
          SELECT
            MIN(final_price) AS min_price,

            SUM(
              CASE
                WHEN is_unlimited
                THEN 0
                ELSE stock
              END
            ) AS total_stock

          FROM product_variants

          WHERE product_id = $1
            AND deleted_at IS NULL
            AND is_active = true
          `,
          [productId]
        );

      const row =
        result.rows[0];

      await client.query(
        `
        UPDATE products
        SET
          final_price = $2,
          stock = $3,
          has_variants = true,
          updated_at = NOW()
        WHERE id = $1
        `,
        [
          productId,
          safeNumber(
            row?.min_price
          ),
          safeNumber(
            row?.total_stock
          ),
        ]
      );
    }
  );
}
