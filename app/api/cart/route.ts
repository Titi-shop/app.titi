import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";

import {
  getCart,
  upsertCartItems,
  deleteCartItem,
  updateCartItemQuantity,
} from "@/lib/db/cart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type CartItemInput = {
  product_id: string;
  variant_id?: string | null;
  quantity?: number;
};

/* =========================================================
   GET CART
========================================================= */

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    console.log("[CART][GET] user:", userId);

    const items = await getCart(userId);

    console.log("[CART][GET] items_count:", items.length);

    return NextResponse.json(items);
  } catch (err) {
    console.error("[CART][GET_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN",
    });

    return NextResponse.json(
      { error: "GET_CART_FAILED" },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST (ADD / UPSERT)
========================================================= */

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    console.log("[CART][POST] user:", userId);

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      console.warn("[CART][POST] INVALID_BODY_JSON");

      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    console.log("[CART][POST] raw_body:", JSON.stringify(body));

    const rawItems: unknown[] = Array.isArray(body) ? body : [body];

    /* ================= VALIDATE ================= */

    const items: CartItemInput[] = rawItems
      .map((item) => {
        if (typeof item !== "object" || item === null) return null;

        const row = item as Record<string, unknown>;

        if (typeof row.product_id !== "string") return null;

        const quantity =
          typeof row.quantity === "number" &&
          !Number.isNaN(row.quantity)
            ? row.quantity
            : 1;

        return {
          product_id: row.product_id,
          variant_id:
            typeof row.variant_id === "string"
              ? row.variant_id
              : null,
          quantity,
        };
      })
      .filter((i): i is CartItemInput => i !== null);

    console.log("[CART][POST] validated_items:", items);

    if (items.length === 0) {
      console.warn("[CART][POST] INVALID_ITEMS_EMPTY");

      return NextResponse.json(
        { error: "INVALID_ITEMS" },
        { status: 400 }
      );
    }

    /* ================= UPSERT ================= */

    console.log("[CART][POST] UPSERT_START");

    await upsertCartItems(userId, items);

    console.log("[CART][POST] UPSERT_DONE");

    /* ================= RETURN UPDATED CART ================= */

    const updatedCart = await getCart(userId);

    console.log(
      "[CART][POST] updated_count:",
      updatedCart.length
    );

    return NextResponse.json(updatedCart);
  } catch (err: unknown) {
    const errorCode =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code?: string }).code
        : undefined;

    console.error("[CART][POST_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN",
      code: errorCode,
    });

    return NextResponse.json(
      { error: "UPSERT_CART_FAILED" },
      { status: 500 }
    );
  }
}

/* =========================================================
   DELETE ITEM
========================================================= */

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    console.log("[CART][DELETE] user:", userId);

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      console.warn("[CART][DELETE] INVALID_BODY_JSON");

      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    const productId =
      typeof data.product_id === "string"
        ? data.product_id
        : null;

    const variantId =
      typeof data.variant_id === "string"
        ? data.variant_id
        : null;

    console.log("[CART][DELETE] target:", {
      productId,
      variantId,
    });

    if (!productId) {
      console.warn("[CART][DELETE] INVALID_PRODUCT_ID");

      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    await deleteCartItem(userId, productId, variantId);

    console.log("[CART][DELETE] DONE");

    const updatedCart = await getCart(userId);

    return NextResponse.json(updatedCart);
  } catch (err) {
    console.error("[CART][DELETE_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN",
    });

    return NextResponse.json(
      { error: "DELETE_CART_FAILED" },
      { status: 500 }
    );
  }
}

/* =========================================================
   PATCH (UPDATE QUANTITY)
========================================================= */

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    console.log("[CART][PATCH] user:", userId);

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      console.warn("[CART][PATCH] INVALID_BODY_JSON");

      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    const productId =
      typeof data.product_id === "string"
        ? data.product_id
        : null;

    const variantId =
      typeof data.variant_id === "string"
        ? data.variant_id
        : null;

    const quantity =
      typeof data.quantity === "number" &&
      !Number.isNaN(data.quantity)
        ? data.quantity
        : null;

    console.log("[CART][PATCH] update:", {
      productId,
      variantId,
      quantity,
    });

    if (!productId || quantity === null) {
      console.warn("[CART][PATCH] INVALID_INPUT");

      return NextResponse.json(
        { error: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    await updateCartItemQuantity(
      userId,
      productId,
      variantId,
      quantity
    );

    console.log("[CART][PATCH] DONE");

    const updatedCart = await getCart(userId);

    return NextResponse.json(updatedCart);
  } catch (err) {
    console.error("[CART][PATCH_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN",
    });

    return NextResponse.json(
      { error: "UPDATE_CART_FAILED" },
      { status: 500 }
    );
  }
}
