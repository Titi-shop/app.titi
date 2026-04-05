"use client";

import { useEffect, useState, useRef } from "react";

interface PiPriceData {
  price_usd: number;
  change_24h: number | null;
}

export default function PiPriceWidget() {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number | null>(null);

  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchPrice = async () => {
      try {
        const res = await fetch("/api/pi-price");
        const data: PiPriceData = await res.json();

        if (!mounted) return;

        if (data.price_usd !== undefined) {
          prevPriceRef.current = price;
          setPrice(Number(data.price_usd));
        }

        if (data.change_24h !== undefined) {
          setChange(Number(data.change_24h));
        }
      } catch (e) {
        console.error("Không thể lấy giá Pi:", e);
      }
    };

    fetchPrice();

    const interval = setInterval(fetchPrice, 15000); // 15s (giảm tải)

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []); // ✅ FIX

  let priceColor = "text-orange-500";

  if (change !== null) {
    if (change > 0) priceColor = "text-green-600";
    else if (change < 0) priceColor = "text-red-600";
  }

  const isUp = change !== null && change > 0;
  const isDown = change !== null && change < 0;

  return (
    <div className="w-full flex justify-center py-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">1 PI =</span>

        <span className={`text-lg font-bold ${priceColor}`}>
          {price !== null ? price.toFixed(6) : "..."}
        </span>

        <span className="text-gray-500">USD</span>

        {change !== null && (
          <span
            className={`text-xs font-semibold flex items-center gap-1
              ${isUp ? "text-green-600" : ""}
              ${isDown ? "text-red-600" : ""}
            `}
          >
            {isUp && "▲"}
            {isDown && "▼"}
            {change.toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  );
}
