"use client";

import {
  Activity,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface PiPriceData {
  price_usd: number;
  change_24h: number | null;
}

export default function PiPriceWidget() {
  const [price, setPrice] = useState<number>(0);

  const [change, setChange] = useState<number>(0);

  const [history, setHistory] = useState<number[]>([]);

  const [flash, setFlash] = useState<
    "up" | "down" | null
  >(null);

  const prevPriceRef = useRef<number>(0);

  /* =========================================================
     FETCH
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    const fetchPrice = async () => {
      try {
        const res = await fetch("/api/pi-price", {
          cache: "no-store",
        });

        if (!res.ok) return;

        const data: PiPriceData =
          await res.json();

        if (!mounted) return;

        const nextPrice = Number(
          data.price_usd || 0
        );

        const oldPrice =
          prevPriceRef.current;

        if (oldPrice !== 0) {
          if (nextPrice > oldPrice) {
            setFlash("up");
          }

          if (nextPrice < oldPrice) {
            setFlash("down");
          }

          setTimeout(() => {
            setFlash(null);
          }, 500);
        }

        prevPriceRef.current = nextPrice;

        setPrice(nextPrice);

        setChange(Number(data.change_24h || 0));

        setHistory((prev) => {
          const next = [...prev, nextPrice];

          return next.slice(-120);
        });
      } catch (err) {
        console.error(
          "PI_PRICE_WIDGET_ERROR",
          err
        );
      }
    };

    fetchPrice();

    // 🔥 cập nhật liên tục kiểu sàn
    const interval = setInterval(
      fetchPrice,
      1200
    );

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  /* =========================================================
     STATES
  ========================================================= */

  const isUp = change >= 0;

  const textColor = isUp
    ? "text-emerald-400"
    : "text-red-400";

  const graphColor = isUp
    ? "#34d399"
    : "#f87171";

  /* =========================================================
     CHART PATH
  ========================================================= */

  const chartPath = useMemo(() => {
    if (history.length < 2) return "";

    const width = 600;

    const height = 120;

    const max = Math.max(...history);

    const min = Math.min(...history);

    return history
      .map((value, index) => {
        const x =
          (index /
            (history.length - 1)) *
          width;

        const y =
          height -
          ((value - min) /
            (max - min || 1)) *
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
    <div className="w-full overflow-hidden rounded-[32px] border border-white/10 bg-[#0b1120] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      {/* HEADER */}

      <div className="relative overflow-hidden px-5 pb-4 pt-5">
        {/* GRID BG */}

        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:22px_22px]" />

        {/* GLOW */}

        <div
          className={`absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl ${
            isUp
              ? "bg-emerald-500/20"
              : "bg-red-500/20"
          }`}
        />

        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-xl">
                <Activity
                  size={22}
                  className="text-orange-400"
                />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
                  Live Market
                </p>

                <h2 className="text-xl font-black text-white">
                  PI / USD
                </h2>
              </div>
            </div>

            <div className="mt-5 flex items-end gap-3">
              <div
                className={`text-4xl font-black tracking-tight transition-all duration-300 ${textColor} ${
                  flash === "up"
                    ? "scale-105"
                    : ""
                } ${
                  flash === "down"
                    ? "scale-95"
                    : ""
                }`}
              >
                {price.toFixed(6)}
              </div>

              <span className="mb-1 text-sm text-white/40">
                USD
              </span>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold ${
              isUp
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {isUp ? (
              <TrendingUp size={16} />
            ) : (
              <TrendingDown size={16} />
            )}

            {change.toFixed(2)}%
          </div>
        </div>

        {/* LIVE CHART */}

        <div className="relative z-10 mt-6 overflow-hidden rounded-2xl border border-white/5 bg-black/20 p-3 backdrop-blur-xl">
          <svg
            viewBox="0 0 600 120"
            preserveAspectRatio="none"
            className="h-[120px] w-full"
          >
            {/* AREA */}

            <defs>
              <linearGradient
                id="fillGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={graphColor}
                  stopOpacity="0.35"
                />

                <stop
                  offset="100%"
                  stopColor={graphColor}
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            <path
              d={`${chartPath} L 600 120 L 0 120 Z`}
              fill="url(#fillGradient)"
            />

            {/* MAIN LINE */}

            <path
              d={chartPath}
              fill="none"
              stroke={graphColor}
              strokeWidth="4"
              strokeLinecap="round"
              className="drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]"
            />
          </svg>
        </div>

        {/* TICKER */}

        <div className="relative z-10 mt-5 overflow-hidden rounded-2xl border border-white/5 bg-white/5 py-3">
          <div className="animate-[ticker_18s_linear_infinite] whitespace-nowrap text-sm font-semibold text-white/70">
            <span className="mx-6">
              PI NETWORK MARKET LIVE
            </span>

            <span className="mx-6 text-emerald-400">
              ▲ {price.toFixed(6)} USD
            </span>

            <span className="mx-6">
              24H VOLUME ACTIVE
            </span>

            <span className="mx-6 text-orange-300">
              REALTIME UPDATE
            </span>

            <span className="mx-6 text-red-400">
              {change.toFixed(2)}%
            </span>

            <span className="mx-6">
              PI NETWORK MARKET LIVE
            </span>
          </div>
        </div>
      </div>

      {/* STYLE */}

      <style jsx>{`
        @keyframes ticker {
          0% {
            transform: translateX(0%);
          }

          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
