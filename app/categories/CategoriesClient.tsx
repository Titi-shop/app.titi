"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import {
  Search,
  ShoppingCart,
  Flame,
  Star,
  ChevronRight,
} from "lucide-react";

import { useCart } from "@/app/context/CartContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import { formatPi } from "@/lib/pi";

import type { Category } from "@/types/category";
import type { Product } from "@/types/product";

/* =========================================================
   FETCHER
========================================================= */

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("FETCH_FAILED");
  }

  return res.json() as Promise<T>;
};

/* =========================================================
   COMPONENT
========================================================= */

export default function CategoriesClient() {
  const { t } = useTranslation();
  const { addToCart } = useCart();

  const [activeCategoryId, setActiveCategoryId] = useState<
    number | null
  >(null);

  const [message, setMessage] = useState<{
    text: string;
    type: "error" | "success";
  } | null>(null);

  /* =========================================================
     EFFECT
  ========================================================= */

  useEffect(() => {
    const prev = document.body.style.background;

    document.body.style.background = "#f5f7fb";

    return () => {
      document.body.style.background = prev;
    };
  }, []);

  /* =========================================================
     DATA
  ========================================================= */

  const {
    data: categoriesData,
    isLoading: loadingCategories,
  } = useSWR<Category[]>(
    "/api/categories",
    fetcher
  );

  const {
    data: productsData,
    isLoading: loadingProducts,
  } = useSWR<Product[]>(
    "/api/products",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  const categories = useMemo(() => {
    return categoriesData || [];
  }, [categoriesData]);

  const products = useMemo(() => {
    return productsData || [];
  }, [productsData]);

  const loading =
    loadingCategories || loadingProducts;

  /* =========================================================
     FILTER
  ========================================================= */

  const visibleProducts = useMemo(() => {
    if (activeCategoryId === null) {
      return products;
    }

    return products.filter(
      (p) => p.category_id === activeCategoryId
    );
  }, [products, activeCategoryId]);

  /* =========================================================
     FEATURED
  ========================================================= */

  const featuredProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 6);
  }, [products]);

  /* =========================================================
     MESSAGE
  ========================================================= */

  const showMessage = (
    text: string,
    type: "error" | "success" = "error"
  ) => {
    setMessage({ text, type });

    setTimeout(() => {
      setMessage(null);
    }, 2500);
  };

  /* =========================================================
     CART
  ========================================================= */

  const handleAddToCart = (
    e: React.MouseEvent,
    product: Product
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!product.is_active) {
      showMessage(
        t.product_unavailable ||
          "Product unavailable"
      );

      return;
    }

    if (
      product.stock <= 0 &&
      !product.is_unlimited
    ) {
      showMessage(
        t.out_of_stock || "Out of stock"
      );

      return;
    }

    addToCart({
      id: String(product.id),
      product_id: product.id,
      name: product.name,
      price: product.price,
      sale_price: product.final_price,
      quantity: 1,
      thumbnail: product.thumbnail,
    });

    showMessage(
      t.added_to_cart || "Added",
      "success"
    );
  };

  /* =========================================================
     EMPTY
  ========================================================= */

  if (
    !loading &&
    visibleProducts.length === 0
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        🛒 {t.no_products || "No products"}
      </div>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="min-h-screen bg-[#f5f7fb] pb-28">
      {/* MESSAGE */}

      {message && (
        <div
          className={`fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-medium shadow-2xl backdrop-blur-xl ${
            message.type === "error"
              ? "bg-red-500 text-white"
              : "bg-green-500 text-white"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* SEARCH */}

      <div className="sticky top-0 z-40 border-b border-white/40 bg-white/80 backdrop-blur-2xl">
  <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4">

    <div className="flex h-12 flex-1 items-center gap-3 rounded-2xl bg-gray-100 px-4">
      <Search
        size={18}
        className="text-gray-400"
      />

      <input
        type="text"
        placeholder={
          t.search_products ||
          "Search products..."
        }
        className="w-full bg-transparent text-sm outline-none"
      />
    </div>

    <button className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
      <ShoppingCart size={18} />

      <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
        2
      </span>
    </button>

  </div>
</div>
{/* HERO */}

<section className="px-4 pt-4">
  <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 p-6 text-white shadow-[0_20px_80px_rgba(255,90,31,0.35)]">

    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

    <div className="relative z-10">

      <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold backdrop-blur-xl">
        <Flame size={14} />

        {t.trending_marketplace ||
          "Trending Marketplace"}
      </div>

      <h1 className="mt-5 max-w-xl text-3xl font-black leading-tight">
        {t.discover_modern_products ||
          "Discover products from modern commerce experiences"}
      </h1>

      <p className="mt-3 max-w-md text-sm text-white/80">
        {t.smart_shopping_discovery ||
          "Trending products, curated collections and smart shopping discovery."}
      </p>

      <button className="mt-6 flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black">
        {t.explore_now || "Explore Now"}

        <ChevronRight size={16} />
      </button>

    </div>
  </div>
</section>

      {/* CATEGORY CHIPS */}

      <section className="mt-6 overflow-x-auto px-4">
        <div className="flex gap-3 pb-2">
          <button
            onClick={() =>
              setActiveCategoryId(null)
            }
            className={`whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-semibold transition-all ${
              activeCategoryId === null
                ? "bg-black text-white shadow-xl"
                : "bg-white text-gray-600"
            }`}
          >
              {t.all || "All"}
          </button>

          {categories.map((category) => {
            const active =
              activeCategoryId === category.id;

            return (
              <button
                key={category.id}
                onClick={() =>
                  setActiveCategoryId(
                    category.id
                  )
                }
                className={`flex items-center gap-2 whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-semibold transition-all ${
                  active
                    ? "bg-black text-white shadow-xl"
                    : "bg-white text-gray-700"
                }`}
              >
                {category.icon && (
                  <img
                    src={category.icon}
                    alt={category.name}
                    className="h-5 w-5 object-contain"
                  />
                )}

                {category.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* TRENDING */}

<section className="mt-8 px-4">
  <div className="mb-5 flex items-center justify-between">

    <div>
      <h2 className="text-2xl font-black">
        {t.trending_now || "Trending Now"}
      </h2>

      <p className="mt-1 text-sm text-gray-500">
        {t.most_popular_products_today ||
          "Most popular products today"}
      </p>
    </div>

    <button className="text-sm font-semibold text-gray-500">
      {t.view_all || "View all"}
    </button>

  </div>

        <div className="flex gap-4 overflow-x-auto pb-2">
          {featuredProducts.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.id}`}
              className="min-w-[220px]"
            >
              <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                <div className="relative">
                  <Image
                    src={
                      product.thumbnail ||
                      "/placeholder.png"
                    }
                    alt={product.name}
                    width={400}
                    height={400}
                    className="h-52 w-full object-cover"
                  />

                  <div className="absolute left-3 top-3 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">
  {t.hot || "HOT"}
</div>

                </div>

                <div className="p-4">
                  <h3 className="line-clamp-2 text-sm font-semibold">
                    {product.name}
                  </h3>

                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    <Star
                      size={14}
                      className="fill-yellow-400 text-yellow-400"
                    />

                    {product.rating_avg || 5}

                    <span>
                      • {product.sold} sold
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-lg font-black text-red-500">
                        {formatPi(
                          product.final_price
                        )}{" "}
                        π
                      </p>
                    </div>

                    <button
                      onClick={(e) =>
                        handleAddToCart(
                          e,
                          product
                        )
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-white transition-all active:scale-95"
                    >
                      <ShoppingCart size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* PRODUCT GRID */}

      <section className="mt-10 px-4">
        <div className="mb-5">
    
<h2 className="text-2xl font-black">
  {t.discover_products ||
    "Discover Products"}
</h2>

<p className="mt-1 text-sm text-gray-500">
  {t.curated_products_for_you ||
    "Curated products for you"}
</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-[28px] bg-white"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {visibleProducts.map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
              >
                <div className="group overflow-hidden rounded-[28px] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                  <div className="relative overflow-hidden">
                    <Image
                      src={
                        product.thumbnail ||
                        "/placeholder.png"
                      }
                      alt={product.name}
                      width={500}
                      height={500}
                      className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {product.sale_price && (
                      <div className="absolute left-3 top-3 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">
                  {t.sale || "SALE"}
                 </div>
                    )}

                    <button
                      onClick={(e) =>
                        handleAddToCart(
                          e,
                          product
                        )
                      }
                      className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-black shadow-xl backdrop-blur-xl transition-all active:scale-95"
                    >
                      <ShoppingCart size={18} />
                    </button>
                  </div>

                  <div className="p-4">
                    <h3 className="line-clamp-2 min-h-[40px] text-sm font-semibold">
                      {product.name}
                    </h3>

                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                      <Star
                        size={14}
                        className="fill-yellow-400 text-yellow-400"
                      />

                      {product.rating_avg || 5}

                      <span>
                        • {product.sold} {t.sold || "sold"}
                      </span>
                    </div>

                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="text-lg font-black text-red-500">
                          {formatPi(
                            product.final_price
                          )}{" "}
                          π
                        </p>

                        {product.sale_price && (
                          <p className="text-xs text-gray-400 line-through">
                            {formatPi(
                              product.price
                            )}{" "}
                            π
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
