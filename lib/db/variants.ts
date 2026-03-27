const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is missing");
}

if (!SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
}

/* =========================================================
   TYPES
========================================================= */

export type VariantRow = {
  id: string;
  product_id: string;
  option_name: string;
  option_value: string;
  stock: number;
  sku: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type ProductVariant = {
  id?: string;
  optionName?: string;
  optionValue: string;
  stock: number;
  sku?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

/* =========================================================
   HELPERS
========================================================= */

function supabaseHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

function toAppVariant(row: VariantRow): ProductVariant {
  return {
    id: row.id,
    optionName: row.option_name || "size",
    optionValue: row.option_value || "",
    stock:
      typeof row.stock === "number" && !Number.isNaN(row.stock)
        ? row.stock
        : 0,
    sku: row.sku ?? null,
    sortOrder:
      typeof row.sort_order === "number" && !Number.isNaN(row.sort_order)
        ? row.sort_order
        : 0,
    isActive: row.is_active !== false,
  };
}

function normalizeVariant(
  variant: ProductVariant,
  index = 0
) {
  return {
    option_name:
      typeof variant.optionName === "string" && variant.optionName.trim() !== ""
        ? variant.optionName.trim()
        : "size",

    option_value:
      typeof variant.optionValue === "string"
        ? variant.optionValue.trim()
        : "",

    stock:
      typeof variant.stock === "number" &&
      !Number.isNaN(variant.stock) &&
      variant.stock >= 0
        ? variant.stock
        : 0,

    sku:
      typeof variant.sku === "string" && variant.sku.trim() !== ""
        ? variant.sku.trim()
        : null,

    sort_order:
      typeof variant.sortOrder === "number" &&
      !Number.isNaN(variant.sortOrder)
        ? variant.sortOrder
        : index,

    is_active:
      typeof variant.isActive === "boolean"
        ? variant.isActive
        : true,
  };
}

/* =========================================================
   GET — VARIANTS BY PRODUCT ID
========================================================= */

export async function getVariantsByProductId(
  productId: string
): Promise<ProductVariant[]> {
  if (!productId) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  const url =
    `${SUPABASE_URL}/rest/v1/product_variants` +
    `?product_id=eq.${encodeURIComponent(productId)}` +
    `&is_active=eq.true` +
    `&order=sort_order.asc`;

  const res = await fetch(url, {
    headers: supabaseHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ SUPABASE GET VARIANTS ERROR:", text);
    throw new Error("FAILED_TO_FETCH_VARIANTS");
  }

  const rows: VariantRow[] = await res.json();

  return rows.map(toAppVariant);
}

/* =========================================================
   POST — CREATE VARIANTS
========================================================= */

export async function createVariantsForProduct(
  productId: string,
  variants: ProductVariant[]
): Promise<ProductVariant[]> {
  if (!productId) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  if (!Array.isArray(variants) || variants.length === 0) {
    return [];
  }

  const payload = variants
    .map((variant, index) => {
      const normalized = normalizeVariant(variant, index);

      return {
        ...normalized,
        product_id: productId,
      };
    })
    .filter(
      (v) =>
        typeof v.option_value === "string" &&
        v.option_value.trim() !== ""
    );

  if (payload.length === 0) {
    return [];
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/product_variants`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ CREATE VARIANTS ERROR:", text);
    throw new Error("FAILED_TO_CREATE_VARIANTS");
  }

  const rows: VariantRow[] = await res.json();

  return rows.map(toAppVariant);
}

/* =========================================================
   DELETE — ALL VARIANTS
========================================================= */

export async function deleteVariantsByProductId(
  productId: string
): Promise<boolean> {
  if (!productId) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  const url =
    `${SUPABASE_URL}/rest/v1/product_variants` +
    `?product_id=eq.${encodeURIComponent(productId)}`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      ...supabaseHeaders(),
      Prefer: "return=representation",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ DELETE VARIANTS ERROR:", text);
    throw new Error("FAILED_TO_DELETE_VARIANTS");
  }

  return true;
}

/* =========================================================
   REPLACE — DELETE + CREATE
========================================================= */

export async function replaceVariantsByProductId(
  productId: string,
  variants: ProductVariant[]
): Promise<ProductVariant[]> {
  await deleteVariantsByProductId(productId);

  if (!Array.isArray(variants) || variants.length === 0) {
    return [];
  }

  return createVariantsForProduct(productId, variants);
}
