import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { getSellerProducts } from "@/lib/db/products";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    /* =========================
       1️⃣ AUTH
    ========================= */
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    /* =========================
       2️⃣ MAP pi_uid → userId (uuid)
    ========================= */
    const userRes = await query(
      `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
      [auth.user.pi_uid]
    );

    if (userRes.rowCount === 0) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const userId = userRes.rows[0].id;

    /* =========================
       3️⃣ GET PRODUCTS (DB LAYER)
    ========================= */
    const products = await getSellerProducts(userId);

    /* =========================
       4️⃣ RESPONSE
    ========================= */
    return NextResponse.json(products);

  } catch (err) {
    console.error("❌ SELLER PRODUCTS ERROR:", err);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
