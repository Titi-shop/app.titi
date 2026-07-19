"use client";

import useSWR from "swr";
import {
  useMemo,
  useEffect,
} from "react";

import type {
  ProductRecord,
  ProductVariant,
  ShippingRate,
} from "@/types/Product";

/* =========================================================
   FETCHER
========================================================= */
const fetcher = async (url: string) => {
  const res = await fetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
};
/* =========================================================
   HOOK
========================================================= */

export function useProduct(
  id: string
) {
  const {
  data,
  isLoading,
} = useSWR(
      id
        ? `/api/products/${id}`
        : null,
      fetcher,
      {
  revalidateOnFocus: false,
  revalidateIfStale: false,
  keepPreviousData: true,
  dedupingInterval: 60000,
}
    );
useEffect(() => {
  if (!id) return;

  void fetch("/api/products/view", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });
}, [id]);
  const product = useMemo(() => {
    if (
      !data ||
      typeof data !== "object"
    ) {
      return null;
    }

    const api =
  data as Partial<ProductRecord>;

    const normalizedProduct = {
      ...api,

      /* ARRAYS */

      images: Array.isArray(
        api.images
      )
        ? api.images
        : [],

      variants: Array.isArray(
        api.variants
      )
        ? (api.variants as ProductVariant[])
        : [],

      shipping_rates:
        Array.isArray(
          api.shipping_rates
        )
          ? (api.shipping_rates as ShippingRate[])
          : [],

      /* NUMBERS */

      rating_avg: Number(
        api.rating_avg ?? 0
      ),

      rating_count: Number(
        api.rating_count ?? 0
      ),

      sold: Number(
        api.sold ?? 0
      ),

      stock: Number(
        api.stock ?? 0
      ),

      views: Number(
        api.views ?? 0
      ),
favorite_count: Number(
  api.favorite_count ?? 0
),

is_favorite:
  api.is_favorite === true,
      price: Number(
        api.price ?? 0
      ),

      sale_price:
        api.sale_price != null
          ? Number(api.sale_price)
          : null,

      final_price: Number(
        api.final_price ??
          api.sale_price ??
          api.price ??
          0
      ),

      /* SAFE BOOLEAN */

      is_active:
        api.is_active !== false,

      is_unlimited:
        api.is_unlimited === true,

      sale_enabled:
        api.sale_enabled === true,

      /* DERIVED */

      is_sale:
        !!api.sale_price &&
        Number(
          api.final_price ??
            api.sale_price ??
            0
        ) <
          Number(api.price ?? 0),

      is_out_of_stock:
        !api.is_unlimited &&
        Number(api.stock ?? 0) <=
          0,
    };

    return normalizedProduct as ProductRecord & {
      is_sale: boolean;

      is_out_of_stock: boolean;
    };
  }, [data]);

  return {
  product,
  isLoading,
};
}
