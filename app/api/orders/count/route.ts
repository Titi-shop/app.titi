import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getBuyerOrderCounts } from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const userId = auth.userId;

  /* ================= VALIDATE ================= */
  if (!userId || typeof userId !== "string") {
    return NextResponse.json(
      { error: "INVALID_USER_ID" },
      { status: 400 }
    );
  }

  try {
    /* ================= DB ================= */
    const data = await getBuyerOrderCounts(userId);

    /* ================= NORMALIZE ================= */
    const counts = {
      pending: Number(data?.pending ?? 0),

      // 🔥 QUAN TRỌNG: pickup -> confirmed
      confirmed: Number(
        data?.confirmed ?? data?.pickup ?? 0
      ),

      shipping: Number(data?.shipping ?? 0),
      completed: Number(data?.completed ?? 0),
      cancelled: Number(data?.cancelled ?? 0),
    };

    return NextResponse.json(counts);
  } catch (err) {
    console.error("GET /orders/count error:", err);

    /* ================= SAFE FALLBACK ================= */
    return NextResponse.json(
      {
        pending: 0,
        confirmed: 0,
        shipping: 0,
        completed: 0,
        cancelled: 0,
      },
      { status: 200 }
    );
  }
}
