"use client";

export const dynamic = "force-dynamic";

import "swiper/css";
import "swiper/css/pagination";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";

/* ================= TYPES ================= */

type ReturnItem = {
  product_name: string;
  thumbnail: string;
  quantity: number;
  unit_price: number;
};

type ReturnDetail = {
  id: string;
  return_number: string;
  status: string;
  reason: string;
  evidence_images?: string[];
  items: ReturnItem[];
};

/* ================= PAGE ================= */

export default function SellerReturnDetail() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  /* ================= LOAD ================= */

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await apiAuthFetch(`/api/seller/returns/${id}`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /* ================= IMAGE LIST ================= */

  const allImages: string[] = [
    ...(data?.items?.map((i) => i.thumbnail) ?? []),
    ...(data?.evidence_images ?? []),
  ].filter((i) => typeof i === "string" && i.length > 5);

  /* ================= ZOOM STATE ================= */

  const scaleRef = useRef(1);
  const posRef = useRef({ x: 0, y: 0 });
  const startRef = useRef({ x: 0, y: 0 });

  const lastTapRef = useRef(0);

  function resetTransform(el: HTMLImageElement) {
    scaleRef.current = 1;
    posRef.current = { x: 0, y: 0 };
    el.style.transform = `translate(0px,0px) scale(1)`;
  }

  /* ================= DOUBLE TAP ================= */

  function handleDoubleTap(e: React.TouchEvent, el: HTMLImageElement) {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (scaleRef.current === 1) {
        scaleRef.current = 2;
      } else {
        scaleRef.current = 1;
        posRef.current = { x: 0, y: 0 };
      }

      el.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px) scale(${scaleRef.current})`;
    }
    lastTapRef.current = now;
  }

  /* ================= PINCH ZOOM ================= */

  const pinchStartRef = useRef(0);

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx =
        e.touches[0].clientX - e.touches[1].clientX;
      const dy =
        e.touches[0].clientY - e.touches[1].clientY;
      pinchStartRef.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1) {
      startRef.current = {
        x: e.touches[0].clientX - posRef.current.x,
        y: e.touches[0].clientY - posRef.current.y,
      };
    }
  }

  function handleTouchMove(e: React.TouchEvent, el: HTMLImageElement) {
    if (e.touches.length === 2) {
      const dx =
        e.touches[0].clientX - e.touches[1].clientX;
      const dy =
        e.touches[0].clientY - e.touches[1].clientY;

      const dist = Math.sqrt(dx * dx + dy * dy);
      let scale = dist / pinchStartRef.current;

      scale = Math.min(Math.max(scale, 1), 4);
      scaleRef.current = scale;

      el.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px) scale(${scale})`;
    }

    if (e.touches.length === 1 && scaleRef.current > 1) {
      posRef.current = {
        x: e.touches[0].clientX - startRef.current.x,
        y: e.touches[0].clientY - startRef.current.y,
      };

      el.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px) scale(${scaleRef.current})`;
    }
  }

  /* ================= UI ================= */

  if (loading) return <p className="p-4">Loading...</p>;
  if (!data) return <p className="p-4">Not found</p>;

  return (
    <main className="min-h-screen bg-gray-100 pb-20">

      {/* PRODUCT */}
      <div className="bg-white">
        {data.items.map((item, i) => (
          <div key={i} className="flex gap-3 p-4">
            <img
              src={item.thumbnail}
              onClick={() => setPreviewIndex(i)}
              className="w-20 h-20 object-cover rounded border"
            />
            <div>
              <p>{item.product_name}</p>
              <p className="text-xs">Qty: {item.quantity}</p>
              <p className="font-semibold">π{item.unit_price}</p>
            </div>
          </div>
        ))}
      </div>

      {/* EVIDENCE */}
      <div className="bg-white p-4">
        <div className="flex gap-2 overflow-x-auto">
          {allImages.map((src, i) => (
            <img
              key={i}
              src={src}
              onClick={() => setPreviewIndex(i)}
              className="w-24 h-24 object-cover rounded border"
            />
          ))}
        </div>
      </div>

      {/* ================= PREVIEW ================= */}

      {previewIndex !== null && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col h-screen">

          {/* HEADER */}
          <div className="flex justify-between p-3 text-white">
            <button onClick={() => setPreviewIndex(null)}>←</button>
            <span>{previewIndex + 1}/{allImages.length}</span>
            <span />
          </div>

          <Swiper
            key={previewIndex}
            modules={[Pagination]}
            pagination={{ clickable: true }}
            initialSlide={previewIndex}
            className="flex-1 h-full"
          >
            {allImages.map((src, i) => (
              <SwiperSlide key={i}>
                <div className="flex items-center justify-center h-full">

                  <img
                    src={src}
                    className="max-h-full max-w-full object-contain transition-transform duration-100"
                    onTouchStart={(e) => {
                      handleDoubleTap(e, e.currentTarget);
                      handleTouchStart(e);
                    }}
                    onTouchMove={(e) =>
                      handleTouchMove(e, e.currentTarget)
                    }
                    onDoubleClick={(e) =>
                      resetTransform(e.currentTarget)
                    }
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder.png";
                    }}
                  />

                </div>
              </SwiperSlide>
            ))}
          </Swiper>

        </div>
      )}

    </main>
  );
}
