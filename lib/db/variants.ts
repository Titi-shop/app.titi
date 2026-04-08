import { query, withTransaction } from "@/lib/db";

/* =========================
   TYPES
========================= */
export type ProductVariant = {
  id?: string;
  optionName?: string;
  optionValue: string;
  stock: number;
  sku?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

/* =========================
   VALIDATE
========================= */
function validateVariants(variants: ProductVariant[]) {
  if (!Array.isArray(variants)) return [];

  return variants.filter(
    (v) =>
      v &&
      typeof v.optionValue === "string" &&
      v.optionValue.trim() !== ""
  );
}

/* =========================
   NORMALIZE
========================= */
function normalizeVariant(v: ProductVariant, index: number) {
  return {
    option_name: v.optionName?.trim() || "size",
    option_value: v.optionValue.trim(),
    stock: Number.isFinite(v.stock) ? v.stock : 0,
    sku: v.sku?.trim() || null,
    sort_order:
      typeof v.sortOrder === "number" ? v.sortOrder : index,
    is_active: v.isActive ?? true,
  };
}

/* =========================
   GET
========================= */
export async function getVariantsByProductId(productId: string) {
  if (!productId) throw new Error("INVALID_PRODUCT_ID");

  const res = await query(
    `
    SELECT id, option_name, option_value, stock, sku, sort_order, is_active
    FROM product_variants
    WHERE product_id = $1
    ORDER BY sort_order ASC
    `,
    [productId]
  );

  return res.rows.map((r) => ({
    id: r.id,
    optionName: r.option_name,
    optionValue: r.option_value,
    stock: r.stock,
    sku: r.sku,
    sortOrder: r.sort_order,
    isActive: r.is_active,
  }));
}

/* =========================
   REPLACE (SAFE + ATOMIC)
========================= */
export async function replaceVariantsByProductId(
  productId: string,
  variants: ProductVariant[]
) {
  if (!productId) throw new Error("INVALID_PRODUCT_ID");

  const valid = validateVariants(variants);

  await withTransaction(async (client) => {
    // delete old
    await client.query(
      `DELETE FROM product_variants WHERE product_id = $1`,
      [productId]
    );

    if (valid.length === 0) return;

    const normalized = valid.map(normalizeVariant);

    const values: unknown[] = [];
    const placeholders: string[] = [];

    normalized.forEach((v, i) => {
      const idx = i * 7;

      placeholders.push(
        `($${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5},$${idx + 6},$${idx + 7})`
      );

      values.push(
        productId,
        v.option_name,
        v.option_value,
        v.stock,
        v.sku,
        v.sort_order,
        v.is_active
      );
    });

    await client.query(
      `
      INSERT INTO product_variants
      (product_id, option_name, option_value, stock, sku, sort_order, is_active)
      VALUES ${placeholders.join(",")}
      `,
      values
    );
  });
}
