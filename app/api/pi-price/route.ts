import { NextResponse } from "next/server";

export const runtime = "nodejs"; // ✅ rule 25
export const revalidate = 15;    // ✅ cache server 15s

interface OkxTickerData {
  last: string;
  sodUtc8?: string;
}

interface OkxResponse {
  data?: OkxTickerData[];
}

// 🔥 cache in-memory (≤60s đúng rule 28)
let cache: {
  price: number;
  change: number | null;
  ts: number;
} | null = null;

export async function GET() {
  const now = Date.now();

  // ✅ dùng cache nếu < 10s
  if (cache && now - cache.ts < 10000) {
    return NextResponse.json({
      symbol: "PI/USDT",
      price_usd: cache.price,
      change_24h: cache.change,
      source: "CACHE",
      updated_at: new Date(cache.ts).toISOString(),
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // nhanh hơn

  try {
    const res = await fetch(
      "https://www.okx.com/api/v5/market/ticker?instId=PI-USDT",
      {
        next: { revalidate: 15 }, // ✅ Next cache
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`OKX_${res.status}`);
    }

    const json: OkxResponse = await res.json();

    if (!json.data || json.data.length === 0) {
      throw new Error("INVALID_OKX_RESPONSE");
    }

    const ticker = json.data[0];

    const price = Number(ticker.last);
    const sod = ticker.sodUtc8 ? Number(ticker.sodUtc8) : null;

    if (!Number.isFinite(price)) {
      throw new Error("INVALID_PRICE");
    }

    let change: number | null = null;

    if (sod !== null && sod !== 0) {
      change = ((price - sod) / sod) * 100;
    }

    // ✅ update cache
    cache = {
      price,
      change,
      ts: now,
    };

    return NextResponse.json({
      symbol: "PI/USDT",
      price_usd: price,
      change_24h: change,
      source: "OKX",
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    clearTimeout(timeout);

    // 🔥 fallback cache nếu OKX lỗi
    if (cache) {
      return NextResponse.json({
        symbol: "PI/USDT",
        price_usd: cache.price,
        change_24h: cache.change,
        source: "FALLBACK",
        updated_at: new Date(cache.ts).toISOString(),
      });
    }

    return NextResponse.json(
      { error: "PI_PRICE_UNAVAILABLE" }, // ✅ chuẩn rule 32
      { status: 500 }
    );
  }
}
