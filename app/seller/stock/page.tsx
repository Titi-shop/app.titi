"use client";

import type { Product as DBProduct } from "@/types/Product";
import { Plus, Upload } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { formatPi } from "@/lib/pi";
import { isNowInRange } from "@/lib/utils/time";

/* =========================
   TYPES
========================= */

type SellerProduct = Pick<
  DBProduct,
  | "id"
  | "name"
  | "price"
  | "salePrice"
  | "saleStart"
  | "saleEnd"
  | "thumbnail"
  | "stock"
  | "sold"
  | "ratingAvg"
  | "isActive"
>;

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

interface Message {
  text: string;
  type: "success" | "error" | "";
}

interface ShopProfile {
  shop_name: string | null;
  shop_banner: string | null;
  avatar_url: string | null;
  shop_description: string | null;
  rating: number | null;
  total_reviews: number | null;
  total_sales: number | null;
}

/* =========================
   HELPERS
========================= */

function normalizeProduct(p: Record<string, unknown>): SellerProduct {
  const price = Number(p.price ?? 0);

  const salePrice =
    typeof p.sale_price === "number" && p.sale_price > 0
      ? Number(p.sale_price)
      : null;

  const saleStart =
    typeof p.sale_start === "string" && p.sale_start
      ? new Date(p.sale_start).toISOString()
      : null;

  const saleEnd =
    typeof p.sale_end === "string" && p.sale_end
      ? new Date(p.sale_end).toISOString()
      : null;

  return {
    id: String(p.id ?? ""),
    name: String(p.name ?? "Unnamed"),
    price,
    salePrice,
    saleStart,
    saleEnd,
    thumbnail:
      typeof p.thumbnail === "string" ? p.thumbnail : "",
    stock: Number(p.stock ?? 0),
    sold: Number(p.sold ?? 0),
    ratingAvg: Number(p.rating_avg ?? 0),
    isActive: Boolean(p.is_active),
  };
}

function isProductOnSale(p: SellerProduct): boolean {
  if (!p.salePrice || p.salePrice <= 0) return false;
  return isNowInRange(p.saleStart, p.saleEnd);
}

/* =========================
   PAGE
========================= */

export default function SellerStockPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { loading: authLoading } = useAuth();

  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const [message, setMessage] = useState<Message>({
    text: "",
    type: "",
  });

  const [shop, setShop] = useState<ShopProfile>({
    shop_name: null,
    shop_banner: null,
    avatar_url: null,
    shop_description: null,
    rating: null,
    total_reviews: null,
    total_sales: null,
  });

  /* ================= LOAD PRODUCTS ================= */

  const loadProducts = useCallback(async () => {
    try {
      const res = await apiAuthFetch("/api/seller/products", {
        cache: "no-store",
      });

      if (!res.ok) {
        setMessage({ text: t.load_products_error, type: "error" });
        return;
      }

      const raw: unknown = await res.json();

      if (!Array.isArray(raw)) {
        setProducts([]);
        return;
      }

      const mapped = raw.map((item) =>
        normalizeProduct(item as Record<string, unknown>)
      );

      setProducts(mapped);
    } catch {
      setMessage({ text: t.load_products_error, type: "error" });
    } finally {
      setPageLoading(false);
    }
  }, [t]);

  /* ================= LOAD PROFILE ================= */

  const loadProfile = useCallback(async () => {
    try {
      const res = await apiAuthFetch("/api/profile", {
        cache: "no-store",
      });

      if (!res.ok) return;

      const data = await res.json();
      const profile = data.profile;

      setShop({
        shop_name: profile?.shop_name ?? null,
        shop_banner: profile?.shop_banner ?? null,
        avatar_url: profile?.avatar_url ?? null,
        shop_description: profile?.shop_description ?? null,
        rating: profile?.rating ?? 0,
        total_reviews: profile?.total_reviews ?? 0,
        total_sales: profile?.total_sales ?? 0,
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (!authLoading) {
      loadProducts();
      loadProfile();
    }
  }, [authLoading, loadProducts, loadProfile]);

  /* ================= DELETE ================= */

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirm_delete)) return;

    try {
      const res = await apiAuthFetch(
        `/api/products?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        setMessage({ text: t.delete_success, type: "success" });
      } else {
        setMessage({ text: t.delete_failed, type: "error" });
      }
    } catch {
      setMessage({ text: t.delete_failed, type: "error" });
    }
  };

  const now = Date.now();

  /* ================= UI ================= */

  return (
    <main className="p-4 max-w-2xl mx-auto pb-28">

      {/* HEADER */}
      <div className="relative mb-10">

        <div className="relative w-full h-40 rounded-xl overflow-hidden">
          <Image
            src={shop.shop_banner || "/banners/default-shop.png"}
            alt="Shop banner"
            fill
            priority
            className="object-cover"
          />

          <button
            onClick={() => router.push("/seller/post")}
            className="absolute top-3 right-3 bg-orange-500 text-white rounded-full w-11 h-11 flex items-center justify-center"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="absolute left-4 -bottom-12 w-24 h-24 rounded-full overflow-hidden border-4 border-white">
          <Image
            src={shop.avatar_url || "/avatar.png"}
            alt="avatar"
            fill
            className="object-cover"
          />
        </div>
      </div>

      {/* PRODUCTS */}
      <div className="space-y-4">

        {pageLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
          ))
        ) : (
          products.map((product) => {
            const isSale = isProductOnSale(product);
            const isOut = (product.stock ?? 0) <= 0;

            return (
              <div
                key={product.id}
                onClick={() => router.push(`/product/${product.id}`)}
                className="flex gap-3 p-3 bg-white rounded-xl shadow cursor-pointer"
              >
                <div className="w-24 h-24 relative rounded-lg overflow-hidden">
                  <Image
                    src={product.thumbnail || "/placeholder.png"}
                    alt={product.name}
                    fill
                    className="object-cover"
                  />
                </div>

                <div className="flex-1">

                  <h3 className="font-semibold text-sm line-clamp-2">
                    {product.name}
                  </h3>

                  {/* PRICE */}
                  <div className="mt-1">
                    {isSale ? (
                      <>
                        <p className="text-xs text-gray-400 line-through">
                          {formatPi(product.price)} π
                        </p>
                        <p className="text-orange-600 font-bold">
                          {formatPi(product.salePrice ?? 0)} π
                        </p>
                      </>
                    ) : (
                      <p className="text-orange-600 font-bold">
                        {formatPi(product.price)} π
                      </p>
                    )}
                  </div>

                  {/* INFO */}
                  <div className="text-xs text-gray-500 mt-2 flex gap-3">
                    <span>📦 {product.stock ?? 0}</span>
                    <span>🛒 {product.sold ?? 0}</span>
                  </div>

                  {/* ACTION */}
                  <div className="flex gap-3 mt-2 text-xs">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/seller/edit/${product.id}`);
                      }}
                      className="text-green-600"
                    >
                      {t.edit}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(product.id);
                      }}
                      className="text-red-600"
                    >
                      {t.delete}
                    </button>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
