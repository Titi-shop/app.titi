import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { getReturnsBySeller } from "@/lib/db/returns";

export const runtime = "nodejs";

/* =====================================================
   GET /api/seller/returns
===================================================== */

export async function GET(): Promise<NextResponse> {
  console.log("🚀 [SELLER RETURNS API] START");

  try {
    /* ================= AUTH ================= */
    const auth = await requireSeller();

    if (!auth.ok) {
      console.error("❌ [SELLER RETURNS] UNAUTHORIZED");
      return auth.response;
    }

    const sellerId = auth.userId;

    console.log("👤 [SELLER RETURNS] USER:", sellerId);

    /* ================= DB ================= */
    const items = await getReturnsBySeller(sellerId);

    console.log("📦 [SELLER RETURNS] COUNT:", items.length);

    return NextResponse.json({
      items,
    });

  } catch (err) {
    console.error("💥 [SELLER RETURNS] ERROR:", err);

    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
