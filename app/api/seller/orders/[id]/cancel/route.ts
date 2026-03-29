import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { cancelOrderBySeller } from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;
    const orderId = params.id;

    if (!orderId) {
      return NextResponse.json(
        { error: "MISSING_ORDER_ID" },
        { status: 400 }
      );
    }

    /* ================= BODY ================= */
    const body = await req.json().catch(() => ({}));

    const cancelReason: string | null =
      typeof body?.cancel_reason === "string"
        ? body.cancel_reason.trim()
        : null;

    /* ================= DB ================= */
    const updated = await cancelOrderBySeller(
      orderId,
      userId,
      cancelReason
    );

    if (!updated) {
      return NextResponse.json(
        { error: "NOTHING_UPDATED" },
        { status: 400 }
      );
    }

    /* ================= DONE ================= */
    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("❌ SELLER CANCEL ERROR:", err);

    return NextResponse.json(
      { error: "FAILED" },
      { status: 500 }
    );
  }
}
