"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import {
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Sparkles,
} from "lucide-react";

import { useCart } from "@/app/context/CartContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";
import type { Product } from "@/types/product";
import type { Category } from "@/types/category";

/* =========================================================
   FETCHER
========================================================= */

const fetcher = async <T,>(
  url: string
): Promise<T> => {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("FETCH_FAILED");
  }

  return res.json() as Promise<T>;
};

/* =========================================================
   HELPERS
========================================================= */

function getImage(src?: string | null) {
  if (!src) return "/placeholder.png";

  return src;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function CategoriesClient() {
  const { t } = useTranslation();
  const { addToCart } = useCart();
  /* =========================================================
     STATE
  ========================================================= */

  const [search, setSearch] =
    useState("");

  const [selectedCategory, setSelectedCategory] =
    useState<number | "all">("all");
  const [sortType, setSortType] =
    useState<
      "popular" | "sale" | "latest"
    >("popular");

  const [message, setMessage] =
    useState<{
      text: string;
      type: "success" | "error";
    } | null>(null);

  /* =========================================================
     DATA
  ========================================================= */

  const {
    data: productsData,
    isLoading: loadingProducts,
  } = useSWR<Product[]>(
    "/api/products",
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
    }
  );

  const {
    data: categoriesData,
    isLoading: loadingCategories,
  } = useSWR<Category[]>(
    "/api/categories",
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const products = useMemo(() => {
    return productsData || [];
  }, [productsData]);

  const categories = useMemo(() => {
    return categoriesData || [];
  }, [categoriesData]);

  const loading =
    loadingProducts ||
    loadingCategories;

  /* =========================================================
     FILTER
  ========================================================= */

  const filteredProducts = useMemo(() => {
    let list = [...products];

    /* CATEGORY */

    if (selectedCategory !== "all") {
      list = list.filter(
        (product) =>
          product.category_id ===
          selectedCategory
      );
    }

    /* SEARCH */

    if (search.trim()) {
      list = list.filter((product) =>
        product.name
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
      );
    }

    /* SORT */

    if (sortType === "popular") {
      list.sort(
        (a, b) => b.sold - a.sold
      );
    }

    if (sortType === "sale") {
      list.sort((a, b) => {
        const discountA =
          a.price -
          (a.final_price ?? a.price);

        const discountB =
          b.price -
          (b.final_price ?? b.price);

        return discountB - discountA;
      });
    }

    if (sortType === "latest") {
      list.reverse();
    }

    return list;
  }, [
    products,
    search,
    selectedCategory,
    sortType,
  ]);

  /* =========================================================
     MESSAGE
  ========================================================= */

  const showMessage = (
    text: string,
    type: "success" | "error" = "error"
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
        t.out_of_stock ||
          "Out of stock"
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
      t.added_to_cart ||
        "Added to cart",
      "success"
    );
  };

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7fb] p-4">
        <div className="animate-pulse space-y-5">
          <div className="h-14 rounded-2xl bg-white" />

          <div className="flex gap-3 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-20 min-w-[90px] rounded-2xl bg-white"
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-72 rounded-[28px] bg-white"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="min-h-screen pb-28 bg-[var(--background)] text-[var(--foreground)] transition-colors">
      {/* MESSAGE */}

      {message && (
        <div
          className={`fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-2xl ${
            message.type === "error"
              ? "bg-red-500 text-white"
              : "bg-green-500 text-white"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* HEADER */}

      <section className="sticky top-0 z-40 border-b border-white/30 bg-white/80 px-4 py-4 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 flex-1 items-center gap-3 rounded-2xl bg-gray-100 px-4">
            <Search
              size={18}
              className="text-gray-400"
            />

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder={
                t.search_products ||
                "Search products..."
              }
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <button
  className="flex h-12 w-12 items-center justify-center rounded-2xl transition-colors"
  style={{
    backgroundColor: "var(--color-primary)",
    color: "#fff",
  }}
>
            <SlidersHorizontal
              size={18}
            />
          </button>
        </div>
      </section>

      {/* HERO */}

      <section className="px-4 pt-5">
        <div
  className="overflow-hidden rounded-[32px] p-6 text-white"
  style={{
    background: `linear-gradient(
      135deg,
      var(--hero-from),
      var(--hero-via),
      var(--hero-to)
    )`,
  }}
>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold backdrop-blur-xl">
                <Sparkles size={14} />

                {t.smart_catalog ||
                  "Smart Catalog"}
              </div>

              <h1 className="mt-5 text-3xl font-black leading-tight">
                {t.explore_categories ||
                  "Explore Categories"}
              </h1>

              <p className="mt-3 max-w-sm text-sm text-white/70">
                {t.find_products_fast ||
                  "Find products faster with category filters and smart discovery."}
              </p>
            </div>

            <div className="rounded-3xl bg-white/10 px-4 py-3 text-center backdrop-blur-xl">
              <p className="text-2xl font-black">
                {
                  filteredProducts.length
                }
              </p>

              <p className="text-xs text-white/70">
                {t.products ||  "Products"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORY LIST */}

      <section className="mt-6 overflow-x-auto px-4">
        <div className="flex gap-3 pb-2">
          <button
            onClick={() =>
              setSelectedCategory(
                "all"
              )
            }
            className={`flex min-w-[82px] flex-col items-center gap-2 rounded-[24px] px-4 py-4 transition-all border-2
${
  selectedCategory === "all"
    ? "border-[var(--color-primary)]"
    : "border-transparent"
}
bg-[var(--card-bg)] text-[var(--foreground)]`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              🛍️
            </div>

            <span className="text-[11px] font-medium">
              {t.all || "All"}
            </span>
          </button>

          {categories.map(
            (category) => {
              const active =
                selectedCategory ===
                category.id;

              return (
                <button
                  key={category.id}
                  onClick={() =>
                    setSelectedCategory(
                      category.id
                    )
                  }
                  className={`flex min-w-[82px] flex-col items-center gap-2 rounded-[24px] px-4 py-4 transition-all border-2
${
  active
    ? "border-[var(--color-primary)]"
    : "border-transparent"
}
bg-[var(--card-bg)] text-[var(--foreground)]`}
                >
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gray-100">
                    <Image
                      src={getImage(
                        category.icon
                      )}
                      alt={
                        category.key
                      }
                      width={50}
                      height={50}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <span className="line-clamp-2 text-center text-[11px] font-medium">
                    {t[
                      category.key
                    ] ||
                      category.key}
                  </span>
                </button>
              );
            }
          )}
        </div>
      </section>

      {/* SORT */}

      <section className="mt-6 overflow-x-auto px-4">
        <div className="flex gap-3">
          {[
            {
              key: "popular",
              label:
                t.best_seller ||
                "Best Seller",
            },

            {
              key: "sale",
              label:
                t.flash_sale ||
                "Flash Sale",
            },

            {
              key: "latest",
              label:
                t.new_arrivals ||
                "New",
            },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() =>
                setSortType(
                  item.key as
                    | "popular"
                    | "sale"
                    | "latest"
                )
              }
              className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-all border-2
${
  sortType === item.key
    ? "border-[var(--color-primary)]"
    : "border-transparent"
}
bg-[var(--card-bg)] text-[var(--foreground)]`}
              
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* PRODUCT GRID */}

      <section className="mt-8 px-4">
        {filteredProducts.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center rounded-[32px] bg-white text-center">
            <p className="text-lg font-bold">
              🛒
            </p>

            <p className="mt-2 text-sm text-gray-500">
              {t.no_products ||
                "No products"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredProducts.map(
              (product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                >
                  <div className="group overflow-hidden rounded-[28px] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                    <div className="relative overflow-hidden">
                      <Image
                        src={getImage(
                          product.thumbnail
                        )}
                        alt={
                          product.name
                        }
                        width={500}
                        height={500}
                        className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />

                      {product.sale_price && (
                        <div className="absolute left-3 top-3 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">
                          SALE
                        </div>
                      )}

                      <button
                        onClick={(e) =>
                          handleAddToCart(
                            e,
                            product
                          )
                        }
                        className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-black shadow-xl"
                      >
                        <ShoppingCart
                          size={18}
                        />
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

                        {product.rating_avg ||
                          5}

                        <span>
                          •{" "}
                          {
                            product.sold
                          }{" "}
                          {t.sold ||
                            "sold"}
                        </span>
                      </div>

                      <div className="mt-4 flex items-end justify-between">
                        <div>
                          <p className="text-lg font-black text-red-500">
                   {formatPi(
              product.final_price ||
    product.sale_price ||
         product.price
            )} π
                </p>

                          {product.sale_price &&
                        product.sale_price < product.price && (
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
              )
            )}
          </div>
        )}
      </section>
    </main>
  );
}
