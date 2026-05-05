import { ProductVariant } from "@/lib/db/variants";

export function normalizeVariants(input: unknown): ProductVariant[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((v, i) => {
      if (!v || typeof v !== "object") return null;

      const item: any = v;

      const price = Number(item.price || 0);

      if (!item.option1) return null;

      return {
        id: item.id,
        option1: item.option1,
        option2: item.option2 ?? null,
        option3: item.option3 ?? null,
        price,
        salePrice: item.salePrice ?? null,
        stock: Number(item.stock || 0),
        saleEnabled: Boolean(item.saleEnabled),
        isActive: item.isActive !== false,
        sortOrder: i,
      };
    })
    .filter(Boolean) as ProductVariant[];
}
