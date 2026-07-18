import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import {
  toggleProductFavorite,
  getFavoriteProductsByUser,
} from "@/lib/db/product-favorites";

/* =========================================================
   POST /api/product-favorites
   Toggle favorite
========================================================= */

export async function POST(req: Request) {
  try {
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body: unknown = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const b = body as Record<string, unknown>;

    const productId =
      typeof b.product_id === "string"
        ? b.product_id
        : null;

    if (!productId) {
      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    const result =
      await toggleProductFavorite(
        auth.userId,
        productId
      );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "TOGGLE FAVORITE ERROR:",
      error
    );

    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/* =========================================================
   GET /api/product-favorites
   Current user's favorites
========================================================= */

export async function GET() {
  try {
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const products =
      await getFavoriteProductsByUser(
        auth.userId
      );

    return NextResponse.json({
      products,
    });
  } catch (error) {
    console.error(
      "GET FAVORITES ERROR:",
      error
    );

    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
