import { query, withTransaction } from "@/lib/db";

/* =========================
   TYPES
========================= */
export type ProductVariant = {
  id?: string;

  optionName?: string;
  optionValue: string;

  price?: number;
  salePrice?: number | null;

  stock: number;

  sku?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

/* =========================
   VALIDATE
========================= */
function validateVariants(input: unknown): ProductVariant[] {
  if (!Array.isArray(input)) return [];

  return input.filter((v): v is ProductVariant => {
    return (
      typeof v === "object" &&
      v !== null &&
      typeof (v as ProductVariant).optionValue === "string" &&
      (v as ProductVariant).optionValue.trim() !== ""
    );
  });
}

/* =========================
   NORMALIZE
========================= */
function normalizeVariant(v: ProductVariant, index: number) {
  const price =
    typeof v.price === "number" &&
    !Number.isNaN(v.price) &&
    v.price >= 0
      ? v.price
      : 0;

  const salePrice =
    typeof v.salePrice === "number" &&
    v.salePrice >= 0 &&
    v.salePrice < price
      ? v.salePrice
      : null;

  const finalPrice = salePrice ?? price;

  return {
    option_1: v.optionValue.trim(),
    option_label_1: v.optionName?.trim() || "option",

    price,
    sale_price: salePrice,
    final_price: finalPrice,

    stock:
      typeof v.stock === "number" && v.stock >= 0
        ? v.stock
        : 0,

    sku:
      typeof v.sku === "string" && v.sku.trim()
        ? v.sku.trim()
        : null,

    sort_order:
      typeof v.sortOrder === "number"
        ? v.sortOrder
        : index,

    is_active:
      typeof v.isActive === "boolean"
        ? v.isActive
        : true,
  };
}

/* =========================
   GET
========================= */
export async function getVariantsByProductId(productId: string) {
  if (!productId || typeof productId !== "string") {
    throw new Error("INVALID_PRODUCT_ID");
  }

  const res = await query(
    `
    SELECT
      id,
      option_1,
      option_label_1,
      price,
      sale_price,
      stock,
      sku,
      sort_order,
      is_active
    FROM product_variants
    WHERE product_id = $1
      AND deleted_at IS NULL
    ORDER BY sort_order ASC
    `,
    [productId]
  );

  return res.rows.map((r) => ({
    id: r.id,

    optionName: r.option_label_1,
    optionValue: r.option_1,

    price: Number(r.price),
    salePrice:
      r.sale_price !== null ? Number(r.sale_price) : null,

    stock: r.stock,
    sku: r.sku,

    sortOrder: r.sort_order,
    isActive: r.is_active,
  }));
}

/* =========================
   REPLACE (ATOMIC)
========================= */
export async function replaceVariantsByProductId(
  productId: string,
  input: unknown
) {
  if (!productId || typeof productId !== "string") {
    throw new Error("INVALID_PRODUCT_ID");
  }

  const valid = validateVariants(input);

  if (valid.length > 100) {
    throw new Error("TOO_MANY_VARIANTS");
  }

  await withTransaction(async (client) => {
    /* DELETE OLD */
    await client.query(
      `DELETE FROM product_variants WHERE product_id = $1`,
      [productId]
    );

    if (valid.length === 0) return;

    const normalized = valid.map(normalizeVariant);

    const values: unknown[] = [];
    const placeholders: string[] = [];

    normalized.forEach((v, i) => {
      const idx = i * 10;

      placeholders.push(
        `($${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5},$${idx + 6},$${idx + 7},$${idx + 8},$${idx + 9},$${idx + 10})`
      );

      values.push(
        productId,
        v.option_1,
        v.option_label_1,
        v.price,
        v.sale_price,
        v.final_price,
        v.stock,
        v.sku,
        v.sort_order,
        v.is_active
      );
    });

    await client.query(
      `
      INSERT INTO product_variants
      (
        product_id,
        option_1,
        option_label_1,
        price,
        sale_price,
        final_price,
        stock,
        sku,
        sort_order,
        is_active
      )
      VALUES ${placeholders.join(",")}
      `,
      values
    );
  });
}
