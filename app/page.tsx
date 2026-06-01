"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { ShoppingCart, Flame, TrendingUp } from "lucide-react";

import BannerCarousel from "./components/BannerCarousel";
import PiPriceWidget from "./components/PiPriceWidget";

import { useCart } from "@/app/context/CartContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";

/* ================= FETCH ================= */

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("FETCH_FAILED");
  return res.json();
};

/* ================= HELPERS ================= */

function getImage(p: any) {
  return p.thumbnail || p.images?.[0] || "/placeholder.png";
}

function getDiscount(p: any) {
  if (p.sale_price && p.price > p.sale_price) {
    return Math.round(((p.price - p.sale_price) / p.price) * 100);
  }
  return 0;
}

/* ================= CARD ================= */

function ProductCard({ product, onAddToCart }: any) {
  const router = useRouter();
  const discount = getDiscount(product);

  return (
    <div
      onClick={() => router.push(`/product/${product.id}`)}
      className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer active:scale-[0.98]"
    >
      {/* IMAGE */}
      <div className="relative">
        <Image
          src={getImage(product)}
          alt={product.name}
          width={300}
          height={300}
          className="w-full h-40 object-cover"
        />

        {discount > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] px-2 py-1 rounded">
            -{discount}%
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart(product);
          }}
          className="absolute top-2 right-2 bg-white p-2 rounded-full shadow"
        >
          <ShoppingCart size={14} />
        </button>
      </div>

      {/* INFO */}
      <div className="p-3">
        <p className="text-sm line-clamp-2 min-h-[38px]">
          {product.name}
        </p>

        <p className="text-red-500 font-bold mt-1">
          {formatPi(product.sale_price ?? product.price)} π
        </p>

        {product.sale_price && (
          <p className="text-xs text-gray-400 line-through">
            {formatPi(product.price)} π
          </p>
        )}

        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500"
            style={{ width: `${Math.min(product.sold ?? 0, 100)}%` }}
          />
        </div>

        <p className="text-[10px] text-gray-500 mt-1">
          {product.sold ?? 0} sold
        </p>
      </div>
    </div>
  );
}

/* ================= PAGE ================= */

export default function HomePage() {
  const { addToCart } = useCart();
  const { t } = useTranslation();

  const [timeLeft, setTimeLeft] = useState("--:--:--");

  const { data: products = [] } = useSWR("/api/products", fetcher);

  /* ================= COUNTDOWN (GLOBAL ONLY) ================= */

  useEffect(() => {
    const end = Date.now() + 2 * 60 * 60 * 1000;

    const timer = setInterval(() => {
      const diff = end - Date.now();

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        clearInterval(timer);
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      setTimeLeft(
        `${String(h).padStart(2, "0")}:${String(m).padStart(
          2,
          "0"
        )}:${String(s).padStart(2, "0")}`
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const flashSaleProducts = useMemo(
    () => products.filter((p: any) => p.sale_price),
    [products]
  );

  return (
    <main className="bg-gray-50 min-h-screen pb-20">
      {/* HERO */}
      <BannerCarousel />

      <div className="px-3 mt-3">
        <PiPriceWidget />
      </div>

      {/* FLASH SALE (STANDARD MARKETPLACE STYLE) */}
      <section className="px-3 mt-5">
        <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl p-3">
          
          {/* HEADER */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Flame size={16} />
              <p className="font-bold text-sm">Flash Sale</p>
            </div>

            <div className="bg-white text-red-600 font-bold px-3 py-1 rounded text-sm">
              {timeLeft}
            </div>
          </div>

          {/* PRODUCTS */}
          <div className="flex gap-3 overflow-x-auto mt-3">
            {flashSaleProducts.slice(0, 10).map((p: any) => (
              <div
                key={p.id}
                className="min-w-[140px] bg-white text-black rounded-lg overflow-hidden"
              >
                <Image
                  src={getImage(p)}
                  alt={p.name}
                  width={200}
                  height={200}
                  className="h-24 w-full object-cover"
                />

                <div className="p-2">
                  <p className="text-xs line-clamp-2 min-h-[32px]">
                    {p.name}
                  </p>

                  <p className="text-red-500 font-bold text-sm">
                    {formatPi(p.sale_price ?? p.price)} π
                  </p>

                  <p className="text-[10px] text-gray-400 line-through">
                    {formatPi(p.price)} π
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRENDING */}
      <section className="px-3 mt-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} />
          <p className="font-bold">Trending</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {products.slice(0, 10).map((p: any) => (
            <ProductCard
              key={p.id}
              product={p}
              onAddToCart={addToCart}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
