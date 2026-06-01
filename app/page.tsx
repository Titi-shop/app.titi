"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import {
  ShoppingCart,
  Flame,
  ChevronRight,
  Star,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import SplashScreen from "./components/SplashScreen";
import BannerCarousel from "./components/BannerCarousel";
import PiPriceWidget from "./components/PiPriceWidget";

import { useCart } from "@/app/context/CartContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";
import type { Product } from "@/types/product";
import type { Category } from "@/types/category";

/* ================= FETCH ================= */

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("FETCH_FAILED");
  return res.json();
};

/* ================= HELPERS ================= */

function getMainImage(product: Product) {
  return product.thumbnail?.trim() || "/placeholder.png";
}

function getDiscount(product: Product) {
  if (product.sale_price && product.price > product.sale_price) {
    return Math.round(
      ((product.price - product.sale_price) / product.price) * 100
    );
  }
  return 0;
}

/* ================= PRODUCT CARD ================= */

function ProductCard({
  product,
  onAddToCart,
  t,
}: {
  product: Product;
  onAddToCart: (p: Product) => void;
  t: Record<string, string>;
}) {
  const router = useRouter();

  const discount = getDiscount(product);
  const isOut =
    !product.is_unlimited && (product.stock ?? 0) <= 0;

  return (
    <div
      onClick={() => router.push(`/product/${product.id}`)}
      className="group overflow-hidden rounded-[30px] bg-white shadow-lg transition hover:-translate-y-1"
    >
      <div className="relative">
        <Image
          src={getMainImage(product)}
          alt={product.name}
          width={500}
          height={500}
          className="h-52 w-full object-cover"
        />

        {discount > 0 && (
          <div className="absolute left-3 top-3 rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
            -{discount}%
          </div>
        )}

        {isOut && (
          <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-2 py-1 text-xs text-white">
            Out of stock
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart(product);
          }}
          className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow"
        >
          <ShoppingCart size={16} />
        </button>
      </div>

      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-semibold">
          {product.name}
        </h3>

        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <Star size={14} className="text-yellow-400 fill-yellow-400" />
          {product.rating_avg || 5}
          <span>• {product.sold} sold</span>
        </div>

        <div className="mt-3">
          <p className="text-lg font-black text-red-500">
            {formatPi(product.final_price || product.price)} π
          </p>

          {product.sale_price && (
            <p className="text-xs text-gray-400 line-through">
              {formatPi(product.price)} π
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= PAGE ================= */

export default function HomePage() {
  const router = useRouter();
  const { addToCart } = useCart();
  const { t } = useTranslation();

  const [showSplash, setShowSplash] = useState(true);

  const { data: productsData, isLoading } = useSWR<Product[]>(
    "/api/products",
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: categoriesData } = useSWR<Category[]>(
    "/api/categories",
    fetcher
  );

  const products = productsData || [];
  const categories = categoriesData || [];

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(t);
  }, []);

  const handleAddToCart = (product: Product) => {
    addToCart({
      id: String(product.id),
      product_id: product.id,
      name: product.name,
      price: product.price,
      sale_price: product.sale_price,
      quantity: 1,
      thumbnail: product.thumbnail,
    });
  };

  const trendingProducts = useMemo(
    () => [...products].sort((a, b) => b.sold - a.sold).slice(0, 8),
    [products]
  );

  if (showSplash || (isLoading && products.length === 0)) {
    return <SplashScreen />;
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-28">

      {/* HERO */}
      <section className="bg-gradient-to-br from-black to-orange-600 px-5 py-8 text-white">
        <BannerCarousel />
        <div className="mt-5">
          <PiPriceWidget />

          <h1 className="mt-5 text-3xl font-black">
            {t.discover_modern_products || "Discover Products"}
          </h1>

          <button
            onClick={() => router.push("/categories")}
            className="mt-4 rounded-xl bg-white px-4 py-2 text-black"
          >
            Explore
          </button>
        </div>
      </section>

      {/* TRENDING */}
      <section className="mt-10 px-4">
        <h2 className="text-xl font-black">Trending</h2>

        <div className="flex gap-4 overflow-x-auto mt-4">
          {trendingProducts.map((p) => (
            <div key={p.id} className="min-w-[200px]">
              <ProductCard product={p} onAddToCart={handleAddToCart} t={t} />
            </div>
          ))}
        </div>
      </section>

      {/* FLASH SALE */}
      <section className="mt-10 px-4">
        <div className="rounded-3xl bg-gradient-to-r from-red-500 to-orange-500 p-5 text-white">

          <div className="mb-4 flex items-center gap-2">
            <Flame size={16} />
            <span className="font-bold">Flash Sale</span>
          </div>

          <div className="flex gap-4 overflow-x-auto">
            {products
              .filter((p) => p.sale_price)
              .slice(0, 10)
              .map((product) => (
                <div
                  key={product.id}
                  onClick={() => router.push(`/product/${product.id}`)}
                  className="min-w-[160px] flex-shrink-0 rounded-2xl bg-white text-black"
                >
                  <Image
                    src={getMainImage(product)}
                    alt={product.name}
                    width={300}
                    height={300}
                    className="h-36 w-full object-cover"
                  />

                  <div className="p-3">
                    <p className="line-clamp-2 text-xs font-medium">
                      {product.name}
                    </p>

                    <p className="mt-2 text-sm font-black text-red-500">
                      {formatPi(product.final_price || product.price)} π
                    </p>

                    <p className="text-[11px] text-gray-400 line-through">
                      {formatPi(product.price)} π
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="mt-10 px-4">
        <h2 className="text-xl font-black">Products</h2>

        <div className="mt-4 grid grid-cols-2 gap-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onAddToCart={handleAddToCart}
              t={t}
            />
          ))}
        </div>
      </section>

    </main>
  );
          }
