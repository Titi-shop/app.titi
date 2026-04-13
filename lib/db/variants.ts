import { query, withTransaction } from "@/lib/db";

/* =========================
   TYPES
========================= */
export type ProductVariant = {
  id?: string;

  optionName?: string;   // "Size"
  optionValue: string;   // "XL"

  price?: number;
  salePrice?: number | null;

  stock: number;

  sku?: string | null;
  image?: string | null;

  sortOrder?: number;
  isActive?: boolean;
};

/* =========================
   VALIDATE
========================= */
function validateVariants(input: unknown): ProductVariant[] {
  if (!Array.isArray(input)) return [];

  return input.filter((v): v is ProductVariant => {
    if (typeof v !== "object" || v === null) return false;

    const value =
      typeof (v as ProductVariant).optionValue === "string"
        ? (v as ProductVariant).optionValue.trim()
        : "";

    if (!value) {
      console.warn("❌ INVALID VARIANT:", v);
      return false;
    }

    return true;
  });
}

/* =========================
   NORMALIZE
========================= */
function normalizeVariant(v: ProductVariant, index: number) {
  const value =
    typeof v.optionValue === "string"
      ? v.optionValue.trim()
      : "";

  if (!value) {
    throw new Error("INVALID_OPTION_VALUE");
  }

  const label =
    typeof v.optionName === "string" && v.optionName.trim()
      ? v.optionName.trim()
      : "option";

  const price =
    typeof v.price === "number" && v.price >= 0
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
    option_1: value,
    option_label_1: label,

    option_2: null,
    option_label_2: null,

    option_3: null,
    option_label_3: null,

    name: value, // 🔥 đơn giản

    price,
    sale_price: salePrice,
    final_price: finalPrice,

    stock: v.stock >= 0 ? v.stock : 0,

    sku: v.sku ?? null,
    image: v.image ?? "",

    sort_order: v.sortOrder ?? index,
    is_active: v.isActive ?? true,
  };
}

/* =========================
   GET
========================= */
export async function getVariantsByProductId(productId: string) {
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
  console.log("🧩 REPLACE VARIANTS:", productId);

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

    console.log("🧩 NORMALIZED:", normalized);

    const values: unknown[] = [];
    const placeholders: string[] = [];

    normalized.forEach((v, i) => {
      const idx = i * 16;

      placeholders.push(
        `($${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5},$${idx + 6},$${idx + 7},$${idx + 8},$${idx + 9},$${idx + 10},$${idx + 11},$${idx + 12},$${idx + 13},$${idx + 14},$${idx + 15},$${idx + 16})`
      );

      values.push(
        productId,

        v.option_1,
        v.option_label_1,

        v.option_2,
        v.option_label_2,

        v.option_3,
        v.option_label_3,

        v.name,

        v.price,
        v.sale_price,
        v.final_price,

        v.stock,

        v.sku,
        v.image,

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

        option_2,
        option_label_2,

        option_3,
        option_label_3,

        name,

        price,
        sale_price,
        final_price,

        stock,

        sku,
        image,

        sort_order,
        is_active
      )
      VALUES ${placeholders.join(",")}
      `,
      values
    );

    console.log("✅ VARIANTS INSERTED");
  });
}
