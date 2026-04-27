
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { previewOrder } from "@/lib/db/orders";

export const runtime = "nodejs";

/* ================= TYPES ================= */

type PreviewItem = {
  product_id: string;
  quantity: number;
  variant_id?: string | null;
};

type PreviewBody = {
  country: string;
  zone: string;
  items: PreviewItem[];
};

/* ================= LOGGER ================= */

const log = {
  info: (msg: string, data?: unknown) =>
    console.log(`[ORDER][PREVIEW][INFO] ${msg}`, data ?? ""),

  warn: (msg: string, data?: unknown) =>
    console.log(`[ORDER][PREVIEW][WARN] ${msg}`, data ?? ""),

  error: (msg: string, data?: unknown) =>
    console.error(`[ORDER][PREVIEW][ERROR] ${msg}`, data ?? ""),
};

/* ================= RESPONSE HELPERS ================= */

function error(code: string, status = 400) {
  log.warn("RESPONSE_ERROR", { code, status });
  return NextResponse.json({ error: code }, { status });
}

/* ================= API ================= */

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    log.info("REQUEST_START");

    /* ================= AUTH ================= */

    const auth = await requireAuth();

    if (!auth.ok) {
      log.error("AUTH_FAILED");
      return auth.response;
    }

    const userId = auth.userId;
    log.info("AUTH_SUCCESS", { userId });

    /* ================= PARSE BODY ================= */

    let body: PreviewBody | null = null;

    try {
      body = await req.json();
    } catch (e) {
      log.error("BODY_PARSE_FAILED");
      return error("INVALID_BODY");
    }

    if (!body) {
      log.warn("EMPTY_BODY");
      return error("INVALID_BODY");
    }

    log.info("BODY_RECEIVED", {
      country: body.country,
      zone: body.zone,
      itemsCount: body.items?.length,
    });

    /* ================= BASIC VALIDATION ================= */

    if (!body.country) {
      log.warn("INVALID_COUNTRY");
      return error("INVALID_COUNTRY");
    }

    if (!body.zone) {
      log.warn("INVALID_ZONE");
      return error("INVALID_ZONE");
    }

    if (!Array.isArray(body.items)) {
      log.warn("INVALID_ITEMS_TYPE");
      return error("INVALID_ITEMS");
    }

    /* ================= CLEAN ITEMS ================= */

    const cleanItems: PreviewItem[] = [];

    for (const item of body.items) {
      if (!item || typeof item !== "object") {
        log.warn("SKIP_INVALID_ITEM", item);
        continue;
      }

      const product_id =
        typeof item.product_id === "string"
          ? item.product_id.trim()
          : "";

      const quantity =
        typeof item.quantity === "number" && item.quantity > 0
          ? item.quantity
          : 0;

      const variant_id =
        typeof item.variant_id === "string"
          ? item.variant_id.trim()
          : null;

      if (!product_id || !quantity) {
        log.warn("INVALID_ITEM_FIELDS", item);
        continue;
      }

      cleanItems.push({
        product_id,
        quantity,
        variant_id,
      });
    }

    if (cleanItems.length === 0) {
      log.warn("NO_VALID_ITEMS");
      return error("INVALID_ITEMS");
    }

    log.info("CLEAN_ITEMS_READY", {
      count: cleanItems.length,
    });

    /* ================= CALL BUSINESS LAYER ================= */

    log.info("CALL_PREVIEW_ORDER");

    const result = await previewOrder({
      userId,
      country: body.country.trim().toUpperCase(),
      zone: body.zone.trim().toLowerCase(),
      items: cleanItems,
    });

    /* ================= SUCCESS ================= */

    const duration = Date.now() - startTime;

    log.info("REQUEST_SUCCESS", {
      duration_ms: duration,
      subtotal: result.subtotal,
      total: result.total,
    });

    return NextResponse.json(result);
  } catch (err) {
    const duration = Date.now() - startTime;

    log.error("UNHANDLED_ERROR", {
      duration_ms: duration,
      error: err instanceof Error ? err.message : err,
    });

    return error("PREVIEW_FAILED", 500);
  }
}
