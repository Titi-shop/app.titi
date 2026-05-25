"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";

interface PiPriceData {
  price_usd: number;
  change_24h: number | null;
}

export default function PiPriceWidget() {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number | null>(null);

  const [flash, setFlash] = useState<
    "up" | "down" | null
  >(null);

  const [history, setHistory] = useState<number[]>(
    []
  );

  const prevPriceRef = useRef<number | null>(null);

  /* =========================================================
     FETCH PRICE
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    const fetchPrice = async () => {
      try {
        const res = await fetch("/api/pi-price");

        if (!res.ok) return;

        const data: PiPriceData =
          await res.json();

        if (!mounted) return;

        const newPrice = Number(
          data.price_usd
        );

        const oldPrice = prevPriceRef.current;

        if (
          oldPrice !== null &&
          newPrice > oldPrice
        ) {
          setFlash("up");

          setTimeout(() => {
            setFlash(null);
          }, 900);
        }

        if (
          oldPrice !== null &&
          newPrice < oldPrice
        ) {
          setFlash("down");

          setTimeout(() => {
            setFlash(null);
          }, 900);
        }

        prevPriceRef.current = newPrice;

        setPrice(newPrice);

        setHistory((prev) => {
          const next = [...prev, newPrice];

          return next.slice(-40);
        });

        if (
          data.change_24h !== undefined &&
          data.change_24h !== null
        ) {
          setChange(
            Number(data.change_24h)
          );
        }
      } catch (err) {
        console.error(
          "PI_PRICE_FETCH_ERROR",
          err
        );
      }
    };

    fetchPrice();

    const interval = setInterval(
      fetchPrice,
      5000
    );

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  /* =========================================================
     STATES
  ========================================================= */

  const isUp =
    change !== null && change >= 0;

  const isDown =
    change !== null && change < 0;

  const priceColor = isUp
    ? "text-emerald-400"
    : "text-red-400";

  const graphColor = isUp
    ? "stroke-emerald-400"
    : "stroke-red-400";

  /* =========================================================
     MINI CHART
  ========================================================= */

  const chartPath = useMemo(() => {
    if (history.length < 2) return "";

    const max = Math.max(...history);
    const min = Math.min(...history);

    const width = 220;
    const height = 70;

    return history
      .map((value, index) => {
        const x =
          (index /
            (history.length - 1)) *
          width;

        const y =
          height -
          ((value - min) /
            ((max - min || 1))) *
            height;

        return `${
          index === 0 ? "M" : "L"
        } ${x} ${y}`;
      })
      .join(" ");
  }, [history]);

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="w-full">
      <div
        className={`
          relative overflow-hidden rounded-[30px]
          border border-white/10
          bg-[#0f172a]
          shadow-[0_10px_50px_rgba(0,0,0,0.25)]
          transition-all duration-500
          ${
            flash === "up"
              ? "ring-2 ring-emerald-400/50"
              : ""
          }
          ${
            flash === "down"
              ? "ring-2 ring-red-400/50"
              : ""
          }
        `}
      >
        {/* BACKGROUND GLOW */}

        <div className="absolute inset-0 overflow-hidden">
          <div
            className={`
              absolute -top-20 right-0 h-52 w-52 rounded-full blur-3xl
              ${
                isUp
                  ? "bg-emerald-500/20"
                  : "bg-red-500/20"
              }
            `}
          />

          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
        </div>

        {/* CONTENT */}

        <div className="relative z-10 p-5">
          {/* TOP */}

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-xl">
                  <Activity
                    size={20}
                    className="text-orange-400"
                  />
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                    PI NETWORK
                  </p>

                  <h2 className="text-lg font-black text-white">
                    PI / USD
                  </h2>
                </div>
              </div>

              <div className="mt-5 flex items-end gap-3">
                <div
                  className={`text-4xl font-black tracking-tight transition-all duration-300 ${priceColor}`}
                >
                  {price !== null
                    ? price.toFixed(6)
                    : "0.000000"}
                </div>

                <span className="mb-1 text-sm font-medium text-white/50">
                  USD
                </span>
              </div>
            </div>

            {/* CHANGE */}

            <div
              className={`
                flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold
                ${
                  isUp
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                }
              `}
            >
              {isUp ? (
                <TrendingUp size={16} />
              ) : (
                <TrendingDown size={16} />
              )}

              {change !== null
                ? `${change.toFixed(2)}%`
                : "--"}
            </div>
          </div>

          {/* CHART */}

          <div className="mt-6">
            <svg
              viewBox="0 0 220 70"
              className="h-[80px] w-full"
              preserveAspectRatio="none"
            >
              <path
                d={chartPath}
                fill="none"
                strokeWidth="3"
                className={`${graphColor} drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]`}
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* BOTTOM */}

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

              Live market update
            </div>

            <div className="text-xs text-white/40">
              Auto refresh 5s
            </div>
          </div>
        </div>
      </div>
    </div>
  );
    }
