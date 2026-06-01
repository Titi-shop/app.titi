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
HELPERS
========================================================= */

function getMainImage(product: Product) {
if (
product.thumbnail &&
product.thumbnail.trim().length > 0
) {
return product.thumbnail;
}

return "/placeholder.png";
}

function getDiscount(product: Product) {
if (
product.sale_price &&
product.price > product.sale_price
) {
return Math.round(
((product.price - product.sale_price) /
product.price) *
100
);
}

return 0;
}

/* =========================================================
PRODUCT CARD
========================================================= */

function ProductCard({ product, onAddToCart, t }: any) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/product/${product.id}`)}
      className="overflow-hidden rounded-lg bg-white shadow-sm active:scale-[0.98] transition border border-gray-100"
    >
      {/* IMAGE */}
      <div className="relative">
        <Image
          src={getMainImage(product)}
          alt={product.name}
          width={500}
          height={500}
          className="h-44 w-full object-cover"
        />

        {product.sale_price && (
          <div className="absolute left-2 top-2 rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white">
            -{getDiscount(product)}%
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="p-2">
        <p className="line-clamp-2 text-[12px] font-medium text-gray-900">
          {product.name}
        </p>

        <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
          <Star size={12} className="fill-yellow-400 text-yellow-400" />
          {product.rating_avg || 5}
          <span>• {product.sold || 0} sold</span>
        </div>

        <div className="mt-2">
          <p className="text-sm font-bold text-red-600">
            {formatPi(product.final_price || product.price)} π
          </p>

          {product.sale_price && (
            <p className="text-[11px] text-gray-400 line-through">
              {formatPi(product.price)} π
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg bg-white border border-gray-100">
      {/* IMAGE SKELETON */}
      <div className="h-44 w-full bg-gray-200 animate-pulse relative overflow-hidden">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.2s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      </div>

      {/* TEXT */}
      <div className="p-2 space-y-2">
        <div className="h-3 w-full bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />

        <div className="flex items-center gap-2 mt-2">
          <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
        </div>

        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mt-2" />
      </div>
    </div>
  );
}
/* =========================================================
PAGE
========================================================= */

export default function HomePage() {
const router = useRouter();
const { addToCart } = useCart();
const { t } = useTranslation();
const [showSplash, setShowSplash] = useState(false);

const [selectedCategory, setSelectedCategory] =
useState<number | "all">("all");

const [message, setMessage] = useState<{
text: string;
type: "error" | "success";
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
dedupingInterval: 10000,
}
);

const products = useMemo(() => {
return productsData || [];
}, [productsData]);

const categories = useMemo(() => {
return categoriesData || [];
}, [categoriesData]);

const loading =
loadingProducts || loadingCategories;

/* =========================================================
EFFECTS
========================================================= */

useEffect(() => {
const timer = setTimeout(() => {
setShowSplash(false);
}, 1200);

return () => clearTimeout(timer);

}, []);

useEffect(() => {
const hasSeenSplash = sessionStorage.getItem("splash_seen");

if (!hasSeenSplash) {
setShowSplash(true);

const timer = setTimeout(() => {  
  setShowSplash(false);  
  sessionStorage.setItem("splash_seen", "1");  
}, 1200);  

return () => clearTimeout(timer);

}
}, []);
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
FILTER
========================================================= */

const filteredProducts = useMemo(() => {
if (selectedCategory === "all") {
return products;
}

return products.filter(  
  (p) =>  
    Number(p.category_id) ===  
    Number(selectedCategory)  
);

}, [products, selectedCategory]);

/* =========================================================
TRENDING
========================================================= */

const trendingProducts = useMemo(() => {
return [...products]
.sort((a, b) => b.sold - a.sold)
.slice(0, 8);
}, [products]);

/* =========================================================
CART
========================================================= */

const handleAddToCart = (product: Product) => {
if (!product.is_active) {
showMessage(
t.product_unavailable || "Product unavailable"
);
return;
}

const isOutOfStock =
!product.is_unlimited &&
(product.stock ?? 0) <= 0;

if (isOutOfStock) {
showMessage(
t.out_of_stock || "Out of stock"
);
return;
}

const hasVariant =
Boolean(product.has_variants) ||
(product.variants?.length ?? 0) > 0 ||
(product.options?.size?.length ?? 0) > 0;

if (hasVariant) {
showMessage(
t.please_select_variant ||
"Please select variant before adding to cart"
);

return;

}

addToCart({
id: String(product.id),
product_id: product.id,
name: product.name,
price: product.price,
sale_price:
product.final_price || product.sale_price,
quantity: 1,
thumbnail: product.thumbnail,
});

showMessage(
t.added_to_cart || "Added to cart",
"success"
);
};

/* =========================================================
LOADING
========================================================= */

if (
showSplash ||
(loading && products.length === 0)
) {
return <SplashScreen />;
}

/* =========================================================
UI
========================================================= */

return (
<main className="min-h-screen pb-28 bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">
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

  {/* HERO */}

<section className="relative w-full overflow-hidden border-b-4 border-orange-500 bg-gradient-to-br from-black via-gray-900 to-orange-600 px-5 pb-10 pt-6 text-white">  
  {/* glow effects */}  
  <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-orange-500/20 blur-3xl" />  
  <div className="absolute bottom-0 left-0 h-44 w-44 rounded-full bg-red-500/20 blur-3xl" />  {/* subtle edge highlight */}

  <div className="pointer-events-none absolute inset-0 ring-1 ring-orange-400/30" />    <div className="relative z-10">  
    <BannerCarousel /> 
    <div className="mt-5 flex justify-center">  
  <PiPriceWidget />  
</div>  

<div className="mt-8">  
  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold backdrop-blur-xl">  
    <Sparkles size={14} />  
    {t.future_marketplace || "Future Marketplace"}  
  </div>  

  <h1 className="mt-5 max-w-xl text-4xl font-black leading-tight">  
    {t.discover_modern_products ||  
      "Discover modern commerce experiences"}  
  </h1>  

  <p className="mt-4 max-w-md text-sm text-white/80">  
    {t.smart_shopping_discovery ||  
      "Trending products, curated collections and next generation shopping."}  
  </p>  

  <button  
    onClick={() => router.push("/categories")}  
    className="mt-6 flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black shadow-lg active:scale-95 transition"  
  >  
    {t.explore_now || "Explore Now"}  
    <ChevronRight size={16} />  
  </button>  
</div>

  </div>  
</section>  
      {/* CATEGORIES */} 
  <section className="mt-6 px-4">  
    <div className="mb-4 flex items-center justify-between">  
      <div>  
        <h2 className="text-2xl font-black">  
          {t.categories ||  
            "Categories"}  
        </h2>  

        <p className="mt-1 text-sm"  
      style={{ color: "var(--text-muted, #9ca3af)" }}>  
          {t.shop_by_category ||  
            "Shop by category"}  
        </p>  
      </div>  
    </div>  

    <div className="flex gap-4 overflow-x-auto pb-2">  
      <button  
        onClick={() =>  
          setSelectedCategory("all")  
        }  
       className={`flex min-w-[82px] flex-col items-center gap-2 rounded-[24px] px-4 py-4 transition-all border-2

${
selectedCategory === "all"
? "border-[var(--color-primary)]"
: "border-transparent"
}
`}
>
<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-2xl">

</div>  

        <span className="text-xs font-semibold">  
          {t.all || "All"}  
        </span>  
      </button>  

      {categories.map((category) => {  
        const active =  
          Number(selectedCategory) ===  
          Number(category.id);  

        return (  
          <button  
            key={category.id}  
            onClick={() =>  
              setSelectedCategory(  
                Number(category.id)  
              )  
            }  
            className={`flex min-w-[90px] flex-col items-center gap-2 rounded-[24px] px-4 py-4 transition-all border-2  
  ${

active
? "border-[var(--color-primary)]"
: "border-transparent"
}
`}
>
<div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gray-100">
<Image
src={
category.icon ||
"/placeholder.png"
}
alt={category.key}
width={80}
height={80}
className="h-full w-full object-cover"
/>
</div>

<span className="line-clamp-2 text-center text-[11px] font-semibold">  
              {t[category.key] ||  
                category.key}  
            </span>  
          </button>  
        );  
      })}  
    </div>  
  </section>  

  {/* TRENDING */}  

  <section className="mt-10 px-4">  
    <div className="mb-5 flex items-center justify-between">  
      <div>  
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-600">  
          <TrendingUp size={14} />  

          {t.trending_now ||  
            "Trending Now"}  
        </div>  

        <h2 className="text-2xl font-black">  
          {t.best_selling_products ||  
            "Best selling products"}  
        </h2>  
      </div>  

      <button  
        onClick={() =>  
          router.push("/categories")  
        }  
        className="text-sm font-semibold text-gray-500"  
      >  
        {t.view_all || "View all"}  
      </button>  
    </div>  

    <div className="flex gap-4 overflow-x-auto pb-2">  
      {trendingProducts.map((product) => (  
        <div  
          key={product.id}  
          className="min-w-[240px]"  
        >  
          <ProductCard  
            product={product}  
            onAddToCart={  
              handleAddToCart  
            }  
            t={t}  
          />  
        </div>  
      ))}  
    </div>  
  </section>  
{/* FLASH SALE */}
<section className="mt-10 -mx-4 px-4 py-6 bg-gradient-to-r from-red-600 via-orange-500 to-red-500 text-white relative overflow-hidden">

  {/* glow */}
  <div className="absolute -top-10 -left-10 h-40 w-40 bg-white/10 rounded-full blur-3xl" />
  <div className="absolute bottom-0 right-0 h-40 w-40 bg-black/10 rounded-full blur-3xl" />

  {/* HEADER */}
  <div className="flex items-center justify-between mb-4">
    <div>
      <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur">
        <Flame size={14} />
        {t.flash_sale || "Flash Sale"}
      </div>

      <h2 className="mt-2 text-lg font-black">
        {t.flashSale_subtitle || "Limited time deals"}
      </h2>
    </div>

    <button
      onClick={() => router.push("/flash-sale")}
      className="text-xs font-semibold bg-white/20 px-3 py-2 rounded-xl active:scale-95"
    >
      {t.flashSale_viewAll || "View all"}
    </button>
  </div>

  {/* FEATURED PRODUCT (1 ITEM VERTICAL) */}
  {products
    .filter((p) => p.sale_price)
    .slice(0, 1)
    .map((product) => {
      const discount = getDiscount(product);

      return (
        <div
          key={product.id}
          onClick={() => router.push(`/product/${product.id}`)}
          className="bg-white text-black rounded-2xl overflow-hidden shadow-lg mb-4 active:scale-[0.98] transition"
        >
          <div className="relative">
            <Image
              src={getMainImage(product)}
              alt={product.name}
              width={600}
              height={600}
              className="h-56 w-full object-cover"
            />

            <div className="absolute left-3 top-3 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
              -{discount}%
            </div>
          </div>

          <div className="p-3">
            <p className="text-sm font-semibold line-clamp-2">
              {product.name}
            </p>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-lg font-black text-red-600">
                {formatPi(product.final_price || product.price)} π
              </p>

              <span className="text-xs text-gray-500">
                {product.sold || 0} sold
              </span>
            </div>

            <p className="text-xs text-gray-400 line-through">
              {formatPi(product.price)} π
            </p>
          </div>
        </div>
      );
    })}

  {/* HORIZONTAL LIST (REST PRODUCTS) */}
  <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
    {products
      .filter((p) => p.sale_price)
      .slice(1, 8)
      .map((product) => {
        const discount = getDiscount(product);

        return (
          <div
            key={product.id}
            onClick={() => router.push(`/product/${product.id}`)}
            className="min-w-[140px] bg-white text-black rounded-xl overflow-hidden shadow-md active:scale-[0.98] transition"
          >
            <div className="relative">
              <Image
                src={getMainImage(product)}
                alt={product.name}
                width={300}
                height={300}
                className="h-24 w-full object-cover"
              />

              <div className="absolute left-2 top-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded">
                -{discount}%
              </div>
            </div>

            <div className="p-2">
              <p className="text-[11px] font-semibold line-clamp-2 min-h-[30px]">
                {product.name}
              </p>

              <p className="text-sm font-black text-red-600 mt-1">
                {formatPi(product.final_price || product.price)} π
              </p>
            </div>
          </div>
        );
      })}
  </div>
</section>

  {/* PRODUCTS */}  

  <section className="mt-10 px-0">
  <div className="px-4 mb-5">
    <h2 className="text-2xl font-black">
      {t.discover_products || "Discover Products"}
    </h2>
    <p className="mt-1 text-sm text-gray-500">
      {t.curated_products_for_you || "Curated products for you"}
    </p>
  </div>

  {loading ? (
    <div className="grid grid-cols-2 gap-[6px] px-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <ProductSkeleton key={i} />
      ))}
    </div>
  ) : (
    <div className="grid grid-cols-2 gap-[6px] px-1">
      {filteredProducts.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={handleAddToCart}
          t={t}
        />
      ))}
    </div>
  )}
</section>
</main>

);
            }
