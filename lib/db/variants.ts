
import { query, withTransaction } from "@/lib/db";

/* =========================================================
   FORENSIC LOGGER
========================================================= */
function vlog(step: string, data?: unknown) {
  console.log(`🧪 [DB][VARIANTS] ${step}`, data ?? "");
}

/* =========================================================
   DB TYPE
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

/* =========================================================
   APP TYPE
========================================================= */
export type ProductVariant = {
  id?: string;

  option1?: string;
  option2?: string | null;
  option3?: string | null;

  optionLabel1?: string | null;
  optionLabel2?: string | null;
  optionLabel3?: string | null;

  optionName?: string;
  optionValue?: string;

  name?: string;
  sku?: string | null;

  price?: number;
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

/* =========================================================
   SAFE HELPERS
========================================================= */
function safeNumber(value: unknown, fallback = 0): number {
  if (value === "" || value === null || value === undefined) return fallback;

  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
}

function safeNullableNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;

  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function buildVariantName(v: ProductVariant): string {
  return [v.option1, v.option2, v.option3].filter(Boolean).join(" - ");
}

function calcFinalPrice(v: ProductVariant): number {
  const price = safeNumber(v.price, 0);
  const salePrice = safeNullableNumber(v.salePrice);

  if (
    Boolean(v.saleEnabled) &&
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
export function mapVariantToApp(v: ProductVariantDB): ProductVariant {
  const mapped: ProductVariant = {
    id: v.id,

    option1: v.option_1 ?? "",
    option2: v.option_2 ?? null,
    option3: v.option_3 ?? null,

    optionLabel1: v.option_label_1 ?? null,
    optionLabel2: v.option_label_2 ?? null,
    optionLabel3: v.option_label_3 ?? null,

    optionName: v.option_label_1 ?? "option",
    optionValue: v.option_1 ?? "",

    name: v.name,
    sku: v.sku ?? null,

    price: safeNumber(v.price),
    salePrice: safeNullableNumber(v.sale_price),
    finalPrice: safeNumber(v.final_price),

    saleEnabled: Boolean(v.sale_enabled),
    saleStock: safeNumber(v.sale_stock),
    saleSold: safeNumber(v.sale_sold),

    stock: safeNumber(v.stock),
    isUnlimited: Boolean(v.is_unlimited),

    image: v.image ?? "",

    isActive: Boolean(v.is_active),
    sortOrder: safeNumber(v.sort_order),

    sold: safeNumber(v.sold),
  };

  vlog("MAP_DB_TO_APP", mapped);
  return mapped;
}

/* =========================================================
   MAP APP -> DB
========================================================= */
export function mapVariantToDB(
  v: ProductVariant,
  productId: string,
  sortOrder: number
): ProductVariantDB {
  const mapped: ProductVariantDB = {
    id: v.id,
    product_id: productId,

    option_1: v.option1?.trim() || null,
    option_2: v.option2?.trim() || null,
    option_3: v.option3?.trim() || null,

    option_label_1: v.optionLabel1?.trim() || null,
    option_label_2: v.optionLabel2?.trim() || null,
    option_label_3: v.optionLabel3?.trim() || null,

    name: v.name?.trim() || buildVariantName(v),

    sku: v.sku?.trim() || null,

    price: safeNumber(v.price),
    sale_price: safeNullableNumber(v.salePrice),
    final_price: calcFinalPrice(v),

    sale_enabled: Boolean(v.saleEnabled),
    sale_stock: safeNumber(v.saleStock),
    sale_sold: safeNumber(v.saleSold),

    stock: safeNumber(v.stock),
    is_unlimited: Boolean(v.isUnlimited),

    image: v.image ?? "",

    is_active: v.isActive !== false,
    sort_order: sortOrder,

    sold: safeNumber(v.sold),
    currency: "PI",
  };

  vlog("MAP_APP_TO_DB", mapped);
  return mapped;
}

/* =========================================================
   GET VARIANTS
========================================================= */
export async function getVariantsByProductId(
  productId: string
): Promise<ProductVariant[]> {
  vlog("GET_START", productId);

  const res = await query(
    `
    SELECT *
    FROM product_variants
    WHERE product_id = $1
      AND deleted_at IS NULL
    ORDER BY sort_order ASC, created_at ASC
    `,
    [productId]
  );

  vlog("GET_RAW_ROWS", res.rows);

  const mapped = res.rows.map((row) => mapVariantToApp(row as ProductVariantDB));

  vlog("GET_DONE", mapped);

  return mapped;
}

/* =========================================================
   REPLACE ALL VARIANTS
========================================================= */
export async function replaceVariantsByProductId(
  productId: string,
  input: ProductVariant[]
): Promise<void> {
  return withTransaction(async (client) => {
    vlog("REPLACE_START_PRODUCT", productId);
    vlog("REPLACE_INPUT", input);

    await client.query(`DELETE FROM product_variants WHERE product_id = $1`, [
      productId,
    ]);

    vlog("REPLACE_OLD_DELETED");

    if (!input.length) {
      vlog("REPLACE_NO_INPUT_VARIANTS");
      return;
    }

    const FIELD_COUNT = 22;
    const values: unknown[] = [];
    const placeholders: string[] = [];

    input.forEach((variant, index) => {
      const db = mapVariantToDB(variant, productId, index);

      const rowPlaceholder = Array.from(
        { length: FIELD_COUNT },
        (_, k) => `$${index * FIELD_COUNT + k + 1}`
      ).join(",");

      placeholders.push(`(${rowPlaceholder})`);

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
    });

    vlog("REPLACE_INSERT_VALUES", values);

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
      VALUES ${placeholders.join(",")}
      `,
      values
    );

    vlog("REPLACE_DONE_SUCCESS");
  });
}

/* =========================================================
   DECREASE VARIANT STOCK
========================================================= */
export async function decreaseVariantStock(
  variantId: string,
  quantity: number
): Promise<{ success: true }> {
  return withTransaction(async (client) => {
    vlog("DECREASE_START", { variantId, quantity });

    const res = await client.query(
      `
      SELECT v.*, p.sale_start, p.sale_end
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.id = $1
      FOR UPDATE
      `,
      [variantId]
    );

    if (!res.rows.length) {
      vlog("DECREASE_VARIANT_NOT_FOUND");
      throw new Error("VARIANT_NOT_FOUND");
    }

    const row = res.rows[0] as ProductVariantDB & {
      sale_start: string | null;
      sale_end: string | null;
    };

    vlog("DECREASE_LOCKED_ROW", row);

    if (!row.is_unlimited && safeNumber(row.stock) < quantity) {
      throw new Error("OUT_OF_STOCK");
    }

    const now = Date.now();
    const start = row.sale_start ? new Date(row.sale_start).getTime() : null;
    const end = row.sale_end ? new Date(row.sale_end).getTime() : null;

    const isSaleWindow =
      Boolean(row.sale_enabled) &&
      row.sale_price !== null &&
      start !== null &&
      end !== null &&
      now >= start &&
      now <= end;

    if (isSaleWindow) {
      const left = safeNumber(row.sale_stock) - safeNumber(row.sale_sold);

      vlog("DECREASE_SALE_WINDOW", { left });

      if (left < quantity) {
        throw new Error("FLASH_SALE_SOLD_OUT");
      }
    }

    await client.query(
      `
      UPDATE product_variants
      SET
        stock = CASE
          WHEN is_unlimited THEN stock
          ELSE stock - $2
        END,

        sale_sold = CASE
          WHEN sale_enabled
           AND sale_price IS NOT NULL
          THEN sale_sold + $2
          ELSE sale_sold
        END,

        sold = sold + $2,
        updated_at = NOW()
      WHERE id = $1
      `,
      [variantId, quantity]
    );

    vlog("DECREASE_DONE_SUCCESS");

    return { success: true };
  });
}
