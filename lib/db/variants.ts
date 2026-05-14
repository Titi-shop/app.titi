
import { query, withTransaction } from "@/lib/db";

/* =========================================================
   FORENSIC LOGGER
========================================================= */

function vlog(step: string, data?: unknown) {
  console.log(`🧪 [DB][VARIANTS][V7] ${step}`, data ?? "");
}

/* =========================================================
   TYPES
========================================================= */

export type ProductVariantDB = {
  id?: string;

  product_id: string;

  option_1: string | null;
  option_2: string | null;
  option_3: string | null;

  option_label_1: string | null;
  option_label_2: string | null;
  option_label_3: string | null;

  name: string;

  sku: string | null;

  price: number;
  sale_price: number | null;
  final_price: number;

  sale_enabled: boolean;

  sale_stock: number;
  sale_sold: number;

  stock: number;

  is_unlimited: boolean;

  image: string;

  is_active: boolean;

  sort_order: number;

  sold: number;

  currency: string;

  created_at?: string;
  updated_at?: string;

  deleted_at?: string | null;
};

export type ProductVariant = {
  id?: string;

  option1: string;
  option2?: string | null;
  option3?: string | null;

  optionLabel1?: string | null;
  optionLabel2?: string | null;
  optionLabel3?: string | null;

  optionName?: string;
  optionValue?: string;

  name?: string;

  sku?: string | null;

  price: number;

  salePrice?: number | null;

  finalPrice?: number;

  saleEnabled?: boolean;

  saleStock?: number;

  saleSold?: number;

  stock: number;

  isUnlimited?: boolean;

  image?: string;

  isActive?: boolean;

  sortOrder?: number;

  sold?: number;
};

export type ProductVariantRow = {
  id: string;

  product_id: string;

  price: number;

  sale_price: number | null;

  final_price: number;

  stock: number;

  is_unlimited: boolean;

  is_active: boolean;
};

type VariantWithSaleWindow = ProductVariantDB & {
  sale_start: string | null;
  sale_end: string | null;
};

/* =========================================================
   SAFE HELPERS
========================================================= */

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

function buildVariantName(
  variant: ProductVariant
): string {
  return [
    variant.option1,
    variant.option2,
    variant.option3,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" &&
        value.trim().length > 0
    )
    .join(" - ");
}

function calcFinalPrice(
  variant: ProductVariant
): number {
  const price = safeNumber(variant.price);

  const salePrice = safeNullableNumber(
    variant.salePrice
  );

  if (
    Boolean(variant.saleEnabled) &&
    salePrice !== null &&
    salePrice > 0 &&
    salePrice < price
  ) {
    return salePrice;
  }

  return price;
}

/* =========================================================
   MAP DB -> APP
========================================================= */

export function mapVariantToApp(
  variant: ProductVariantDB
): ProductVariant {
  const mapped: ProductVariant = {
    id: variant.id,

    option1: variant.option_1 ?? "",

    option2: variant.option_2,

    option3: variant.option_3,

    optionLabel1:
      variant.option_label_1,

    optionLabel2:
      variant.option_label_2,

    optionLabel3:
      variant.option_label_3,

    optionName:
      variant.option_label_1 ??
      "option",

    optionValue:
      variant.option_1 ?? "",

    name: variant.name,

    sku: variant.sku,

    price: safeNumber(variant.price),

    salePrice: safeNullableNumber(
      variant.sale_price
    ),

    finalPrice: safeNumber(
      variant.final_price
    ),

    saleEnabled: Boolean(
      variant.sale_enabled
    ),

    saleStock: safeNumber(
      variant.sale_stock
    ),

    saleSold: safeNumber(
      variant.sale_sold
    ),

    stock: safeNumber(variant.stock),

    isUnlimited: Boolean(
      variant.is_unlimited
    ),

    image: variant.image,

    isActive: Boolean(
      variant.is_active
    ),

    sortOrder: safeNumber(
      variant.sort_order
    ),

    sold: safeNumber(variant.sold),
  };

  vlog("MAP_DB_TO_APP", mapped);

  return mapped;
}

/* =========================================================
   MAP APP -> DB
========================================================= */

export function mapVariantToDB(
  variant: ProductVariant,
  productId: string,
  sortOrder: number
): ProductVariantDB {
  const mapped: ProductVariantDB = {
    id: variant.id,

    product_id: productId,

    option_1:
      variant.option1.trim() || null,

    option_2:
      variant.option2?.trim() || null,

    option_3:
      variant.option3?.trim() || null,

    option_label_1:
      variant.optionLabel1?.trim() ||
      null,

    option_label_2:
      variant.optionLabel2?.trim() ||
      null,

    option_label_3:
      variant.optionLabel3?.trim() ||
      null,

    name:
      variant.name?.trim() ||
      buildVariantName(variant),

    sku: variant.sku?.trim() || null,

    price: safeNumber(variant.price),

    sale_price: safeNullableNumber(
      variant.salePrice
    ),

    final_price: calcFinalPrice(
      variant
    ),

    sale_enabled: Boolean(
      variant.saleEnabled
    ),

    sale_stock: safeNumber(
      variant.saleStock
    ),

    sale_sold: safeNumber(
      variant.saleSold
    ),

    stock: safeNumber(variant.stock),

    is_unlimited: Boolean(
      variant.isUnlimited
    ),

    image: variant.image ?? "",

    is_active:
      variant.isActive !== false,

    sort_order: sortOrder,

    sold: safeNumber(variant.sold),

    currency: "PI",
  };

  vlog("MAP_APP_TO_DB", mapped);

  return mapped;
}

/* =========================================================
   GET VARIANTS BY PRODUCT
========================================================= */

export async function getVariantsByProductId(
  productId: string
): Promise<ProductVariant[]> {
  vlog(
    "GET_BY_PRODUCT_START",
    productId
  );

  const result =
    await query<ProductVariantDB>(
      `
      SELECT *
      FROM product_variants
      WHERE product_id = $1
        AND deleted_at IS NULL
      ORDER BY sort_order ASC,
               created_at ASC
      `,
      [productId]
    );

  vlog(
    "GET_BY_PRODUCT_ROWS",
    result.rows
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
): Promise<ProductVariantRow | null> {
  vlog("GET_VARIANT_START", variantId);

  const result =
    await query<ProductVariantRow>(
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

  vlog("GET_VARIANT_RESULT", row);

  return row;
}

/* =========================================================
   VALIDATE OWNERSHIP
========================================================= */

export async function validateVariantOwnership(
  variantId: string,
  productId: string
): Promise<boolean> {
  vlog(
    "VALIDATE_VARIANT_START",
    {
      variantId,
      productId,
    }
  );

  const variant =
    await getVariantById(
      variantId
    );

  if (!variant) {
    vlog(
      "VALIDATE_VARIANT_NOT_FOUND"
    );

    return false;
  }

  if (!variant.is_active) {
    vlog(
      "VALIDATE_VARIANT_INACTIVE"
    );

    return false;
  }

  const matched =
    variant.product_id === productId;

  vlog(
    "VALIDATE_VARIANT_RESULT",
    { matched }
  );

  return matched;
}

/* =========================================================
   REPLACE VARIANTS
========================================================= */

export async function replaceVariantsByProductId(
  productId: string,
  variants: ProductVariant[]
): Promise<void> {
  await withTransaction(
    async (client) => {
      vlog("REPLACE_START", {
        productId,
        count: variants.length,
      });

      await client.query(
        `
        UPDATE product_variants
        SET
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE product_id = $1
          AND deleted_at IS NULL
        `,
        [productId]
      );

      vlog(
        "OLD_VARIANTS_SOFT_DELETED"
      );

      if (!variants.length) {
        vlog("NO_NEW_VARIANTS");

        return;
      }

      const FIELD_COUNT = 22;

      const placeholders: string[] =
        [];

      const values: Array<
        string | number | boolean | null
      > = [];

      variants.forEach(
        (variant, index) => {
          const db =
            mapVariantToDB(
              variant,
              productId,
              index
            );

          const rowPlaceholders =
            Array.from(
              {
                length: FIELD_COUNT,
              },
              (_, k) =>
                `$${
                  index *
                    FIELD_COUNT +
                  k +
                  1
                }`
            ).join(",");

          placeholders.push(
            `(${rowPlaceholders})`
          );

          values.push(
            db.product_id,
            db.option_1,
            db.option_2,
            db.option_3,
            db.option_label_1,
            db.option_label_2,
            db.option_label_3,
            db.name,
            db.sku,
            db.price,
            db.sale_price,
            db.final_price,
            db.sale_enabled,
            db.sale_stock,
            db.sale_sold,
            db.stock,
            db.is_unlimited,
            db.image,
            db.is_active,
            db.sort_order,
            db.sold,
            db.currency
          );
        }
      );

      await client.query(
        `
        INSERT INTO product_variants (
          product_id,
          option_1,
          option_2,
          option_3,
          option_label_1,
          option_label_2,
          option_label_3,
          name,
          sku,
          price,
          sale_price,
          final_price,
          sale_enabled,
          sale_stock,
          sale_sold,
          stock,
          is_unlimited,
          image,
          is_active,
          sort_order,
          sold,
          currency
        )
        VALUES
        ${placeholders.join(",")}
        `,
        values
      );

      vlog("REPLACE_SUCCESS");
    }
  );
}

/* =========================================================
   DECREASE STOCK
========================================================= */

export async function decreaseVariantStock(
  variantId: string,
  quantity: number
): Promise<{ success: true }> {
  return withTransaction(
    async (client) => {
      vlog("DECREASE_START", {
        variantId,
        quantity,
      });

      const result =
        await client.query<VariantWithSaleWindow>(
          `
          SELECT
            v.*,
            p.sale_start,
            p.sale_end
          FROM product_variants v
          JOIN products p
            ON p.id = v.product_id
          WHERE v.id = $1
            AND v.deleted_at IS NULL
          FOR UPDATE
          `,
          [variantId]
        );

      if (!result.rows.length) {
        vlog(
          "VARIANT_NOT_FOUND"
        );

        throw new Error(
          "VARIANT_NOT_FOUND"
        );
      }

      const row = result.rows[0];

      vlog("LOCKED_VARIANT", row);

      if (!row.is_active) {
        throw new Error(
          "VARIANT_INACTIVE"
        );
      }

      if (
        !row.is_unlimited &&
        safeNumber(row.stock) <
          quantity
      ) {
        throw new Error(
          "OUT_OF_STOCK"
        );
      }

      const now = Date.now();

      const start =
        row.sale_start
          ? new Date(
              row.sale_start
            ).getTime()
          : null;

      const end =
        row.sale_end
          ? new Date(
              row.sale_end
            ).getTime()
          : null;

      const isSaleWindow =
        Boolean(
          row.sale_enabled
        ) &&
        row.sale_price !== null &&
        start !== null &&
        end !== null &&
        now >= start &&
        now <= end;

      vlog("SALE_WINDOW", {
        isSaleWindow,
      });

      if (isSaleWindow) {
        const left =
          safeNumber(
            row.sale_stock
          ) -
          safeNumber(
            row.sale_sold
          );

        vlog(
          "SALE_STOCK_LEFT",
          left
        );

        if (left < quantity) {
          throw new Error(
            "FLASH_SALE_SOLD_OUT"
          );
        }
      }

      await client.query(
        `
        UPDATE product_variants
        SET
          stock = CASE
            WHEN is_unlimited
            THEN stock
            ELSE stock - $2
          END,

          sale_sold = CASE
            WHEN $3 = true
            THEN sale_sold + $2
            ELSE sale_sold
          END,

          sold = sold + $2,

          updated_at = NOW()

        WHERE id = $1
        `,
        [
          variantId,
          quantity,
          isSaleWindow,
        ]
      );

      vlog("DECREASE_SUCCESS");

      return {
        success: true,
      };
    }
  );
}
