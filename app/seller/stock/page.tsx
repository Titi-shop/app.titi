"use client";

import { Plus, Upload } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { formatPi } from "@/lib/pi";

/* ================= TYPES ================= */

interface Product {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
  saleStart: string | null;
  saleEnd: string | null;
  thumbnail: string | null;

  stock?: number;
  sold?: number;
  rating_avg?: number;
  isActive?: boolean;
}

interface RawProduct {
  id: unknown;
  name: unknown;
  price: unknown;
  sale_price?: unknown;
  sale_start?: unknown;
  sale_end?: unknown;
  thumbnail?: unknown;

  stock?: unknown;
  sold?: unknown;
  rating_avg?: unknown;
  is_active?: unknown;
}

interface ShopProfile {
  shop_name: string | null;
  shop_banner: string | null;
  avatar_url: string | null;
  shop_description: string | null;
  rating: number | null;
  total_sales: number | null;
}

/* ================= PAGE ================= */

export default function SellerStockPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { loading: authLoading } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [shop, setShop] = useState<ShopProfile>({
    shop_name: null,
    shop_banner: null,
    avatar_url: null,
    shop_description: null,
    rating: null,
    total_sales: null,
  });

  /* ================= LOAD ================= */

  const loadProducts = useCallback(async () => {
    const res = await apiAuthFetch("/api/seller/products");
    const raw = await res.json();

    const mapped: Product[] = raw.map((p: RawProduct) => ({
      id: String(p.id ?? ""),
      name: String(p.name ?? "Unnamed"),
      price: Number(p.price ?? 0),
      salePrice:
        typeof p.sale_price === "number" ? p.sale_price : null,
      saleStart: p.sale_start as string,
      saleEnd: p.sale_end as string,
      thumbnail: String(p.thumbnail ?? "") || null,

      stock: Number(p.stock ?? 0),
      sold: Number(p.sold ?? 0),
      rating_avg: Number(p.rating_avg ?? 0),
      isActive: Boolean(p.is_active),
    }));

    setProducts(mapped);
  }, []);

  const loadProfile = useCallback(async () => {
    const res = await apiAuthFetch("/api/profile");
    const data = await res.json();
    const p = data.profile;

    setShop({
      shop_name: p?.shop_name,
      shop_banner: p?.shop_banner,
      avatar_url: p?.avatar_url,
      shop_description: p?.shop_description,
      rating: p?.rating,
      total_sales: p?.total_sales,
    });
  }, []);

  useEffect(() => {
    if (!authLoading) {
      loadProducts();
      loadProfile();
    }
  }, [authLoading]);

  /* ================= DELETE ================= */

  const handleDelete = async (id: string) => {
    await apiAuthFetch(`/api/products?id=${id}`, { method: "DELETE" });
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  /* ================= UI ================= */

  return (
    <main className="p-4 max-w-2xl mx-auto pb-24">

      {/* ===== SHOP HEADER ===== */}

      <div className="mb-6">

        {/* banner */}
        <div className="relative h-40 rounded-xl overflow-hidden">
          <Image
            src={shop.shop_banner || "/banners/default-shop.png"}
            alt="banner"
            fill
            className="object-cover"
          />

          <button
            onClick={() => router.push("/seller/post")}
            className="absolute top-3 right-3 bg-orange-500 text-white w-10 h-10 rounded-full flex items-center justify-center"
          >
            <Plus />
          </button>
        </div>

        {/* avatar + info */}
        <div className="flex items-center gap-3 mt-3">
          <div className="w-16 h-16 relative">
            <Image
              src={shop.avatar_url || "/avatar.png"}
              alt="avatar"
              fill
              className="rounded-full object-cover"
            />
          </div>

          <div>
            <h2 className="font-bold text-lg">
              {shop.shop_name || "Shop"}
            </h2>

            <p className="text-sm text-gray-500">
              {shop.shop_description || "No description"}
            </p>
          </div>
        </div>
      </div>

      {/* ===== PRODUCTS ===== */}

      <div className="space-y-3">

        {products.map((p) => {

          const isOut = (p.stock ?? 0) <= 0;
          const isOff = p.isActive === false;

          return (
            <div
              key={p.id}
              className="flex gap-3 bg-white p-3 rounded-xl border"
            >

              {/* IMAGE */}
              <div className="relative w-24 h-24 rounded-lg overflow-hidden">

                {/* badge */}
                {isOut && (
                  <span className="absolute top-1 left-1 bg-gray-600 text-white text-xs px-2 py-0.5 rounded">
                    {t.out_of_stock || "Hết hàng"}
                  </span>
                )}

                {isOff && (
                  <span className="absolute top-1 left-1 bg-red-600 text-white text-xs px-2 py-0.5 rounded">
                    {t.inactive || "Ngưng"}
                  </span>
                )}

                <Image
                  src={p.thumbnail || "/placeholder.png"}
                  alt={p.name}
                  fill
                  className={`object-cover ${
                    isOut || isOff ? "opacity-40" : ""
                  }`}
                />
              </div>

              {/* CONTENT */}
              <div className="flex-1">

                <p className="font-medium text-sm line-clamp-2">
                  {p.name}
                </p>

                <p className="text-orange-600 font-bold">
                  {formatPi(p.salePrice ?? p.price)} π
                </p>

                {/* STATS + ACTION */}
                <div className="flex items-center gap-3 text-xs text-gray-600 mt-2">

                  <span>⭐ {p.rating_avg ?? 0}</span>
                  <span>📦 {p.stock ?? 0}</span>
                  <span>🛒 {p.sold ?? 0}</span>

                  <button
                    onClick={() =>
                      router.push(`/seller/edit/${p.id}`)
                    }
                    className="text-green-600"
                  >
                    {t.edit}
                  </button>

                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-red-600"
                  >
                    {t.delete}
                  </button>

                </div>

              </div>

            </div>
          );
        })}
      </div>
    </main>
  );
}
