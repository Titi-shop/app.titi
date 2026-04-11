"use client";

import { formatPi } from "@/lib/pi";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import { ShoppingCart } from "lucide-react";

import {
  formatShortDescription,
  formatDetail,
  calcSalePercent,
  getDistance,
} from "./product.helpers";

import "swiper/css";
import "swiper/css/pagination";

export function ProductView({
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
  handleDoubleTap,
  selectedVariant,
  setSelectedVariant,
  availableVariants,
  canBuy,
  selectedStock,
  hasVariants,
  relatedProducts,
}: any) {
  const displayImages = [
    ...(product.thumbnail ? [product.thumbnail] : []),
    ...product.images.filter((img: string) => img && img !== product.thumbnail),
  ];

  const gallery =
    displayImages.length > 0 ? displayImages : ["/placeholder.png"];

  return (
    <div className="pb-32 bg-gray-50 min-h-screen">
      {/* GALLERY */}
      <div className="mt-14 relative bg-white">
        {product.isSale && (
          <div className="absolute top-3 right-3 bg-red-500 text-white px-2 py-1 text-xs rounded">
            -{calcSalePercent(product.price, product.finalPrice)}%
          </div>
        )}

        <Swiper modules={[Pagination]} pagination={{ clickable: true }}>
          {gallery.map((img: string, i: number) => (
            <SwiperSlide key={i}>
              <img
                src={img}
                onClick={() => {
                  setZoomImage(img);
                  setScale(1);
                  setPosition({ x: 0, y: 0 });
                }}
                className="w-full aspect-square object-cover"
              />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* ZOOM */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center"
          onClick={() => setZoomImage(null)}
        >
          <img
            src={zoomImage}
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={handleDoubleTap}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const d = getDistance(e.touches);
                setInitialDistance(d);
                setInitialScale(scale);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 2) {
                const d = getDistance(e.touches);
                let newScale = initialScale * (d / initialDistance);
                newScale = Math.max(1, Math.min(newScale, 6));
                setScale(newScale);
              }
            }}
            style={{
              transform: `scale(${scale})`,
            }}
            className="max-w-full max-h-full"
          />
        </div>
      )}

      {/* INFO */}
      <div className="bg-white p-4 flex justify-between">
        <h2>{product.name}</h2>
        <div>
          <p className="text-orange-600">
            π {formatPi(product.finalPrice)}
          </p>
        </div>
      </div>

      {/* VARIANTS */}
      {hasVariants && (
        <div className="p-4 bg-white">
          <div className="flex gap-2 flex-wrap">
            {availableVariants.map((v: any) => (
              <button
                key={v.id}
                onClick={() => setSelectedVariant(v)}
                className="border px-3 py-1"
              >
                {v.optionValue}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* DESCRIPTION */}
      <div className="bg-white p-4">
        {formatShortDescription(product.description).map((l, i) => (
          <p key={i}>• {l}</p>
        ))}
      </div>

      {/* DETAIL */}
      <div
        className="p-4 bg-white"
        dangerouslySetInnerHTML={{
          __html: formatDetail(product.detail || ""),
        }}
      />

      {/* RELATED */}
      <div className="p-4">
        {relatedProducts.map((p: any) => (
          <div key={p.id} onClick={() => router.push(`/product/${p.id}`)}>
            {p.name}
          </div>
        ))}
      </div>

      {/* ACTION */}
      <div className="fixed bottom-16 left-0 right-0 bg-white p-3 flex gap-2">
        <button onClick={add} className="flex-1 bg-yellow-500 text-white">
          {t.add_to_cart}
        </button>

        <button onClick={buy} className="flex-1 bg-red-500 text-white">
          {t.buy_now}
        </button>
      </div>
    </div>
  );
}
