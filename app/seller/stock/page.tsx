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
import { isNowInRange } from "@/lib/utils/time"; // ✅ FIX

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
> & {
  min_price?: number;
  min_sale_price?: number | null;
};

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
   HELPERS (FIX)
========================= */
function getDisplayPrice(p: SellerProduct) {
  // ✅ ưu tiên variant price
  const basePrice =
    typeof p.min_price === "number" && p.min_price > 0
      ? p.min_price
      : p.price;

  const baseSale =
    typeof p.min_sale_price === "number" && p.min_sale_price > 0
      ? p.min_sale_price
      : p.salePrice;

  const isSale = isNowInRange(p.saleStart, p.saleEnd);

  return {
    price: basePrice,
    salePrice: isSale ? baseSale : null,
  };
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

  /* ================= LOAD ================= */
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

      const mapped: SellerProduct[] = raw.map((item) => {
        const p = item as Record<string, unknown>;

        return {
          id: String(p.id ?? ""),
          name: String(p.name ?? "Unnamed"),

          price: Number(p.price ?? 0),
          salePrice:
            typeof p.sale_price === "number" ? p.sale_price : null,

          // ✅ FIX DATE
          saleStart:
            typeof p.sale_start === "string" ? p.sale_start : null,
          saleEnd:
            typeof p.sale_end === "string" ? p.sale_end : null,

          // ✅ NEW (variant)
          min_price:
            typeof p.min_price === "number" ? p.min_price : undefined,
          min_sale_price:
            typeof p.min_sale_price === "number"
              ? p.min_sale_price
              : null,

          thumbnail:
            typeof p.thumbnail === "string" ? p.thumbnail : "",

          stock: Number(p.stock ?? 0),
          sold: Number(p.sold ?? 0),
          ratingAvg: Number(p.rating_avg ?? 0),
          isActive: Boolean(p.is_active),
        };
      });

      setProducts(mapped);
    } catch {
      setMessage({ text: t.load_products_error, type: "error" });
    } finally {
      setPageLoading(false);
    }
  }, [t]);

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

  /* ================= UI ================= */
  return (
    <main className="p-4 max-w-2xl mx-auto pb-28">

      {/* LIST */}
      <div className="space-y-4">
        {pageLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-3 bg-white rounded-xl shadow animate-pulse">
                <div className="w-24 h-24 bg-gray-200 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))
          : products.map((product) => {
              const display = getDisplayPrice(product);

              return (
                <div
                  key={product.id}
                  onClick={() => router.push(`/product/${product.id}`)}
                  className="flex gap-3 p-3 bg-white rounded-xl shadow border hover:bg-gray-50 cursor-pointer"
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

                    {/* ✅ FIX PRICE */}
                    <div className="mt-1">
                      {display.salePrice ? (
                        <>
                          <p className="text-xs text-gray-400 line-through">
                            {formatPi(display.price)} π
                          </p>
                          <p className="text-[#ff6600] font-bold">
                            {formatPi(display.salePrice)} π
                          </p>
                        </>
                      ) : (
                        <p className="text-[#ff6600] font-bold">
                          {formatPi(display.price)} π
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3 text-xs mt-2">
                      <span>📦 {product.stock ?? 0}</span>
                      <span>🛒 {product.sold ?? 0}</span>

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
            })}
      </div>
    </main>
  );
}
