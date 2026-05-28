"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* =========================================================
   TYPES
========================================================= */

interface PiPriceResponse {
  symbol: string;

  price_usd: number;

  change_24h: number;

  high_24h?: number;

  low_24h?: number;

  volume_24h?: number;

  updated_at?: string;

  source?: string;
}

type FlashState = "up" | "down" | null;

/* =========================================================
   HELPERS
========================================================= */

function formatPrice(value: number): string {
  return Number(value || 0).toFixed(6);
}

function compactNumber(value: number): string {
  return Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

/* =========================================================
   COMPONENT
========================================================= */

export default function PiPriceWidget() {
  const [loading, setLoading] =
    useState<boolean>(true);

  const [price, setPrice] =
    useState<number>(0);

  const [change, setChange] =
    useState<number>(0);

  const [high24h, setHigh24h] =
    useState<number>(0);

  const [low24h, setLow24h] =
    useState<number>(0);

  const [volume24h, setVolume24h] =
    useState<number>(0);

  const [updatedAt, setUpdatedAt] =
    useState<string>("");

  const [history, setHistory] = useState<
    number[]
  >([]);

  const [flash, setFlash] =
    useState<FlashState>(null);

  const prevPriceRef = useRef<number>(0);

  /* =====================================================
     FETCH
  ===================================================== */

  useEffect(() => {
    let mounted = true;

    async function loadPrice() {
      try {
        const res = await fetch(
          "/api/pi-price",
          {
            cache: "no-store",
          }
        );

        if (!res.ok) {
          return;
        }

        const data: PiPriceResponse =
          await res.json();

        if (!mounted) return;

        const nextPrice = Number(
          data.price_usd || 0
        );

        const oldPrice =
          prevPriceRef.current;

        /* ================= FLASH ================= */

        if (oldPrice > 0) {
          if (nextPrice > oldPrice) {
            setFlash("up");
          }

          if (nextPrice < oldPrice) {
            setFlash("down");
          }

          window.setTimeout(() => {
            setFlash(null);
          }, 500);
        }

        prevPriceRef.current = nextPrice;

        /* ================= UPDATE ================= */

        setPrice(nextPrice);

        setChange(
          Number(data.change_24h || 0)
        );

        setHigh24h(
          Number(data.high_24h || 0)
        );

        setLow24h(
          Number(data.low_24h || 0)
        );

        setVolume24h(
          Number(data.volume_24h || 0)
        );

        setUpdatedAt(
          data.updated_at || ""
        );

        setHistory((prev) => {
          const next = [...prev, nextPrice];

          return next.slice(-60);
        });
      } catch (err) {
        console.error(
          "PI_WIDGET_FETCH_ERROR",
          err
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPrice();

    const interval = window.setInterval(
      loadPrice,
      3000
    );

    return () => {
      mounted = false;

      clearInterval(interval);
    };
  }, []);

  /* =====================================================
     STATES
  ===================================================== */

  const isPositive = change >= 0;

  const priceColor = isPositive
    ? "text-emerald-400"
    : "text-red-400";

  const chartColor = isPositive
    ? "#34d399"
    : "#f87171";

  /* =====================================================
     SVG PATH
  ===================================================== */

  const chartPath = useMemo(() => {
    if (history.length < 2) return "";

    const width = 600;

    const height = 160;

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

  /* =====================================================
     UI
  ===================================================== */

  return (
    <div
      className="
        relative overflow-hidden
        rounded-[34px]
        border border-white/10
        bg-[#081120]
        shadow-[0_30px_80px_rgba(0,0,0,0.45)]
      "
    >
      {/* BG */}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.15),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.15),transparent_35%)]" />

      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />

      {/* CONTENT */}

      <div className="relative z-10 p-5">
        {/* HEADER */}

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="
                flex h-14 w-14 items-center justify-center
                rounded-2xl
                border border-white/10
                bg-white/5
                backdrop-blur-xl
              "
            >
              <Activity
                size={24}
                className="text-orange-400"
              />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
                Live Market
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                PI / USDT
              </h2>
            </div>
          </div>

          <div
            className={`
              flex items-center gap-2
              rounded-2xl px-4 py-2
              text-sm font-bold
              ${
                isPositive
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-red-500/15 text-red-400"
              }
            `}
          >
            {isPositive ? (
              <ArrowUpRight size={16} />
            ) : (
              <ArrowDownRight size={16} />
            )}

            {change.toFixed(2)}%
          </div>
        </div>

        {/* PRICE */}

        <div className="mt-7 flex items-end gap-3">
          <div
            className={`
              text-5xl font-black tracking-tight
              transition-all duration-300
              ${priceColor}
              ${
                flash === "up"
                  ? "scale-105"
                  : ""
              }
              ${
                flash === "down"
                  ? "scale-95"
                  : ""
              }
            `}
          >
            {loading
              ? "--.--"
              : formatPrice(price)}
          </div>

          <span className="mb-1 text-base text-white/40">
            USD
          </span>
        </div>

        {/* MINI STATS */}

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-3 backdrop-blur-xl">
            <p className="text-[11px] uppercase tracking-wider text-white/40">
              24H High
            </p>

            <p className="mt-2 text-sm font-bold text-emerald-400">
              {formatPrice(high24h)}
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-3 backdrop-blur-xl">
            <p className="text-[11px] uppercase tracking-wider text-white/40">
              24H Low
            </p>

            <p className="mt-2 text-sm font-bold text-red-400">
              {formatPrice(low24h)}
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-3 backdrop-blur-xl">
            <p className="text-[11px] uppercase tracking-wider text-white/40">
              Volume
            </p>

            <p className="mt-2 text-sm font-bold text-orange-300">
              {compactNumber(volume24h)}
            </p>
          </div>
        </div>

        {/* CHART */}

        <div
          className="
            mt-6 overflow-hidden
            rounded-3xl
            border border-white/5
            bg-black/20
            p-3
            backdrop-blur-xl
          "
        >
          <svg
            viewBox="0 0 600 160"
            preserveAspectRatio="none"
            className="h-[160px] w-full"
          >
            <defs>
              <linearGradient
                id="piChartFill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={chartColor}
                  stopOpacity="0.4"
                />

                <stop
                  offset="100%"
                  stopColor={chartColor}
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            {/* AREA */}

            <path
              d={`${chartPath} L 600 160 L 0 160 Z`}
              fill="url(#piChartFill)"
            />

            {/* LINE */}

            <path
              d={chartPath}
              fill="none"
              stroke={chartColor}
              strokeWidth="4"
              strokeLinecap="round"
              className="
                drop-shadow-[0_0_14px_rgba(255,255,255,0.35)]
              "
            />
          </svg>
        </div>

        {/* FOOTER */}

        <div
          className="
            mt-5 flex items-center justify-between
            rounded-2xl
            border border-white/5
            bg-white/[0.04]
            px-4 py-3
            text-sm
            backdrop-blur-xl
          "
        >
          <div className="flex items-center gap-2 text-white/50">
            <RefreshCw size={14} />

            <span>
              Real-time market update
            </span>
          </div>

          <span className="text-xs text-white/40">
            {updatedAt
              ? new Date(
                  updatedAt
                ).toLocaleTimeString()
              : "--:--:--"}
          </span>
        </div>

        {/* TICKER */}

        <div
          className="
            mt-5 overflow-hidden
            rounded-2xl
            border border-white/5
            bg-white/[0.03]
            py-3
          "
        >
          <div
            className="
              whitespace-nowrap
              text-sm font-semibold text-white/70
              animate-[ticker_18s_linear_infinite]
            "
          >
            <span className="mx-6">
              PI NETWORK LIVE MARKET
            </span>

            <span className="mx-6 text-emerald-400">
              ▲ {formatPrice(price)} USD
            </span>

            <span className="mx-6">
              REALTIME DATA STREAM
            </span>

            <span className="mx-6 text-orange-300">
              HIGH {formatPrice(high24h)}
            </span>

            <span className="mx-6 text-red-400">
              LOW {formatPrice(low24h)}
            </span>

            <span className="mx-6">
              PI NETWORK LIVE MARKET
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
