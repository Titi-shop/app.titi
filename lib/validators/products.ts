import { ProductVariant } from "@/lib/db/variants";

/* =========================================================
   INPUT TYPE
========================================================= */

type VariantInput = {
  id?: string;

  option1?: string;
  option2?: string | null;
  option3?: string | null;

  optionLabel1?: string | null;
  optionLabel2?: string | null;
  optionLabel3?: string | null;

  name?: string;

  sku?: string | null;

  price?: number | string;

  salePrice?: number | string | null;

  saleEnabled?: boolean;

  saleStock?: number | string;

  saleSold?: number | string;

  stock?: number | string;

  isUnlimited?: boolean;

  image?: string;

  isActive?: boolean;

  sortOrder?: number | string;

  sold?: number | string;
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

  return Number.isNaN(parsed)
    ? fallback
    : parsed;
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

  return Number.isNaN(parsed)
    ? null
    : parsed;
}

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

/* =========================================================
   NORMALIZE VARIANTS
========================================================= */

export function normalizeVariants(
  input: unknown
): ProductVariant[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((raw, index) => {
      if (!isObject(raw)) {
        return null;
      }

      const item =
        raw as VariantInput;

      const option1 =
        item.option1?.trim();

      const option1 = item.option1;
if (typeof option1 !== "string") {
  return null;
}

      const variant: ProductVariant = {
        id: item.id,

        option1,

        option2:
          item.option2?.trim() ||
          null,

        option3:
          item.option3?.trim() ||
          null,

        optionLabel1:
          item.optionLabel1?.trim() ||
          null,

        optionLabel2:
          item.optionLabel2?.trim() ||
          null,

        optionLabel3:
          item.optionLabel3?.trim() ||
          null,

        name:
          item.name?.trim() ||
          undefined,

        sku:
          item.sku?.trim() ||
          null,

        price: safeNumber(
          item.price
        ),

        salePrice:
          safeNullableNumber(
            item.salePrice
          ),

        saleEnabled: Boolean(
          item.saleEnabled
        ),

        saleStock: safeNumber(
          item.saleStock
        ),

        saleSold: safeNumber(
          item.saleSold
        ),

        stock: safeNumber(
          item.stock
        ),

        isUnlimited: Boolean(
          item.isUnlimited
        ),

        image: item.image ?? "",

        isActive:
          item.isActive !== false,

        sortOrder: safeNumber(
          item.sortOrder,
          index
        ),

        sold: safeNumber(
          item.sold
        ),
      };

      return variant;
    })
    .filter(
      (
        variant
      ): variant is ProductVariant =>
        variant !== null
    );
}
