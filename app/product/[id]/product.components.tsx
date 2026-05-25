"use client";

import { useState } from "react";
import { formatPi } from "@/lib/pi";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import { ShoppingCart } from "lucide-react";
import { prefetchProduct } from "@/lib/prefetch";
import type { Product as ProductType } from "@/types/Product";
import {
  formatShortDescription,
  formatDetail,
  calcSalePercent,
} from "./product.helpers";

import "swiper/css";
import "swiper/css/pagination";

export function ProductView(props: any) {
  const {
    product,
    t,
    router,
    add,
    buy,
    zoomImage,
    setZoomImage,
    scale,
    setScale,
    position,
    setPosition,
    dragging,
    setDragging,
    start,
    setStart,
    initialDistance,
    setInitialDistance,
    initialScale,
    setInitialScale,
    selectedVariant,
    setSelectedVariant,
    availableVariants,
    canBuy,
    selectedStock,
    hasVariants,
    relatedProducts,
  } = props;

  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [lastTap, setLastTap] = useState(0);

  if (!product) return null;

  const displayImages = [
    ...(product.thumbnail ? [product.thumbnail] : []),
    ...(Array.isArray(product.images)
      ? product.images.filter((img: string) => img && img !== product.thumbnail)
      : []),
  ];

  const gallery =
    displayImages.length > 0 ? displayImages : ["/placeholder.png"];

  const variantOnSale =
    selectedVariant?.salePrice != null &&
    selectedVariant.salePrice < selectedVariant.price;

  return (
    <div className="pb-28 bg-[#f6f7fb] min-h-screen">

      {/* ================= GALLERY (FULL WIDTH HERO) ================= */}
      <div className="bg-black">
        {product.isSale && (
          <div className="absolute top-3 right-3 z-10 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            -{calcSalePercent(product.price, product.finalPrice)}%
          </div>
        )}

        <Swiper modules={[Pagination]} pagination={{ clickable: true }}>
          {gallery.map((img: string, i: number) => (
            <SwiperSlide key={i}>
              <img
                src={img}
                className="w-full aspect-square object-cover"
                onClick={() => {
                  setZoomImage(img);
                  setActiveImage(img);
                  setScale(1);
                  setPosition({ x: 0, y: 0 });
                }}
              />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* ================= FLOATING INFO CARD ================= */}
      <div className="relative -mt-6 mx-3 bg-white rounded-2xl shadow-lg p-4">

        {/* TITLE */}
        <h1 className="text-base font-semibold text-gray-900">
          {product.name}
        </h1>

        {/* PRICE BLOCK */}
        <div className="mt-2 flex justify-between items-end">
          <div>
            <p className="text-xl font-bold text-orange-500">
              π {formatPi(product.finalPrice ?? product.price)}
            </p>

            {product.finalPrice < product.price && (
              <p className="text-xs text-gray-400 line-through">
                π {formatPi(product.price)}
              </p>
            )}
          </div>

          <div className="text-xs text-gray-500 text-right">
            <div>👁 {product.views || 0}</div>
            <div>⭐ {Number(product.ratingAvg ?? 0).toFixed(1)}</div>
          </div>
        </div>

        {/* STOCK */}
        <div className="mt-2 text-xs">
          {canBuy ? (
            <span className="text-green-600">
              ● {selectedStock} {t.in_stock}
            </span>
          ) : (
            <span className="text-red-500">● {t.out_of_stock}</span>
          )}
        </div>
      </div>

      {/* ================= VARIANTS (CHIP STYLE) ================= */}
      {hasVariants && availableVariants?.length > 0 && (
        <div className="px-3 mt-3 flex gap-2 overflow-x-auto">
          {availableVariants.map((v: any) => {
            const active = selectedVariant?.id === v.id;

            return (
              <button
                key={v.id}
                onClick={() => setSelectedVariant(v)}
                className={`
                  px-3 py-2 rounded-full text-xs whitespace-nowrap border
                  transition
                  ${
                    active
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-gray-600 border-gray-200"
                  }
                `}
              >
                {v.option1 || "Option"}
              </button>
            );
          })}
        </div>
      )}

      {/* ================= DESCRIPTION ================= */}
      <div className="px-4 mt-4 text-sm text-gray-600">
        {formatShortDescription(product.description).slice(0, 3).map((l: string, i: number) => (
          <p key={i}>• {l}</p>
        ))}
      </div>

      {/* ================= DETAIL ================= */}
      <div
        className="bg-white mt-3 mx-3 p-4 rounded-xl text-sm text-gray-700"
        dangerouslySetInnerHTML={{
          __html: formatDetail(product.detail || ""),
        }}
      />

      {/* ================= RELATED ================= */}
      {relatedProducts?.length > 0 && (
        <div className="mt-4 px-3">
          <h3 className="text-sm font-semibold mb-2 text-gray-700">
            {t.product_related_products}
          </h3>

          <div className="flex gap-3 overflow-x-auto">
            {relatedProducts.map((p: any) => (
              <div
                key={p.id}
                onClick={async () => {
                  await prefetchProduct(p.id);
                  router.push(`/product/${p.id}`);
                }}
                className="min-w-[120px] bg-white rounded-xl p-2 shadow-sm"
              >
                <img
                  src={p.thumbnail || "/placeholder.png"}
                  className="w-full h-20 object-cover rounded-lg"
                />

                <p className="text-xs mt-1 line-clamp-2">
                  {p.name}
                </p>

                <p className="text-xs font-semibold text-orange-500">
                  π {formatPi(p.finalPrice)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= STICKY ACTION BAR (PRO UX 2026) ================= */}
      <div
        className="
          fixed left-0 right-0 z-50
          bottom-0
          bg-white/95 backdrop-blur
          border-t border-gray-200
          px-3 py-2
        "
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 6px)",
        }}
      >
        <div className="flex gap-2">
          <button
            onClick={add}
            className="flex-1 h-10 bg-gray-100 text-gray-800 rounded-xl text-sm"
          >
            {t.add_to_cart}
          </button>

          <button
            onClick={buy}
            disabled={hasVariants && !selectedVariant}
            className={`
              flex-1 h-10 rounded-xl text-sm font-semibold
              transition
              ${
                hasVariants && !selectedVariant
                  ? "bg-gray-300 text-gray-500"
                  : "bg-orange-500 text-white active:scale-95"
              }
            `}
          >
            {t.buy_now}
          </button>
        </div>
      </div>
    </div>
  );
}
