import { ProductVariant } from "@/lib/db/variants";

type VariantInput = {
  id?: string;

  option1?: string;
  option2?: string | null;
  option3?: string | null;

  price?: number | string;
  salePrice?: number | string | null;
  stock?: number | string;
  saleStock?: number | string;
  saleEnabled?: boolean;
  isActive?: boolean;
};

export function normalizeVariants(
  input: unknown
): ProductVariant[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((raw, i) => {
      if (
        !raw ||
        typeof raw !== "object"
      ) {
        return null;
      }

      const item = raw as VariantInput;

      if (!item.option1) {
        return null;
      }

      return {
        id: item.id,
        option1: item.option1,
        option2: item.option2 ?? null,
        option3: item.option3 ?? null,
        price: Number(item.price || 0),

        salePrice:
          item.salePrice !== undefined &&
          item.salePrice !== null
            ? Number(item.salePrice)
            : null,

        stock: Number(item.stock || 0),
        saleStock: Number(item.saleStock || 0),
        saleEnabled: Boolean(item.saleEnabled),
        isActive: item.isActive !== false,
        sortOrder: i,
      };
    })
    .filter(
      (
        v
      ): v is ProductVariant => v !== null
    );
}
