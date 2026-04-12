import useSWR from "swr";
import { useMemo } from "react";
import type { Product as ProductType } from "@/types/Product";

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Fetch failed");
  return res.json();
};

export function useProduct(id: string) {
  const { data } = useSWR(
    id ? `/api/products/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: true,
      keepPreviousData: true, // 🔥 QUAN TRỌNG (mượt)
    }
  );

  const product = useMemo(() => {
    if (!data) return null;

    const api = data as ProductType;

    const finalPrice =
      typeof api.salePrice === "number" &&
      api.salePrice < api.price
        ? api.salePrice
        : api.price;

    return {
      ...api,
      finalPrice,

      images: Array.isArray(api.images) ? api.images : [],
      variants: Array.isArray(api.variants) ? api.variants : [],
      shippingRates: Array.isArray(api.shippingRates)
        ? api.shippingRates
        : [],

      ratingAvg: Number(api.ratingAvg ?? 0),
      ratingCount: Number(api.ratingCount ?? 0),

      isSale: finalPrice < api.price,
      isOutOfStock:
        (api.stock ?? 0) <= 0 || api.isActive === false,
    };
  }, [data]);

  return {
    product,
    isLoading: !data, // 👉 vẫn giữ để fallback nếu cần
  };
}
