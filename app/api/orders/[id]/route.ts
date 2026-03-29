import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getOrderByBuyerId } from "@/lib/db/orders";

export async function GET(
  _: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;
    const orderId = params.id;

    if (!orderId) {
      return NextResponse.json(
        { error: "MISSING_ORDER_ID" },
        { status: 400 }
      );
    }

    const order = await getOrderByBuyerId(orderId, userId);

    if (!order) {
      return NextResponse.json(
        { error: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(order);

  } catch (error) {
    console.error("GET ORDER ERROR:", error);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
