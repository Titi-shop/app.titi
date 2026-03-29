import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { completeOrderByBuyer } from "@/lib/db/orders";

export const dynamic = "force-dynamic";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;
    const orderId = params.id;

    if (!orderId) {
      return NextResponse.json(
        { error: "INVALID_ORDER_ID" },
        { status: 400 }
      );
    }

    /* ================= DB ================= */
    const success = await completeOrderByBuyer(
      orderId,
      userId
    );

    if (!success) {
      return NextResponse.json(
        { error: "INVALID_STATUS_OR_NOT_FOUND" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "ORDER_COMPLETED",
    });

  } catch (err) {
    console.error("ORDER COMPLETE ERROR:", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
