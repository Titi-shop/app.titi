import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { getSellerOrderById } from "@/lib/db/orders";

export async function GET(
  { params }: { params: { id: string } }
) {
  try {
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

    const order = await getSellerOrderById(
      orderId,
      userId
    );

    if (!order) {
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(order);

  } catch (error) {
    console.error("SELLER ORDER ERROR:", error);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
