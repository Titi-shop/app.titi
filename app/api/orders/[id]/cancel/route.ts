import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getPiUserFromToken } from "@/lib/piAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* =========================
PATCH /api/orders/[id]/cancel
Buyer cancel order
pending → cancelled
========================= */

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {

    /* ================= AUTH ================= */

    const user = await getPiUserFromToken(req);

    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const userRes = await query(
  `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
  [user.pi_uid]
);

if (userRes.rowCount === 0) {
  return NextResponse.json(
    { error: "USER_NOT_FOUND" },
    { status: 404 }
  );
}

const userId = userRes.rows[0].id;

    const orderId = params.id;

    if (!orderId) {
      return NextResponse.json(
        { error: "INVALID_ORDER_ID" },
        { status: 400 }
      );
    }

    /* ================= BODY ================= */

    const body = await req.json().catch(() => ({}));

    const cancelReason =
      body.cancel_reason ?? "buyer_cancelled";

    /* ================= LOAD ORDER ================= */

    const { rows } = await query(
      `
      select id, buyer_id, status
      from orders
      where id=$1
      `,
      [orderId]
    );

    const order = rows[0];

    if (!order) {
      return NextResponse.json(
        { error: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    /* ================= OWNER CHECK ================= */

    if (order.buyer_id !== userId) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    /* ================= STATUS GUARD ================= */

    if (order.status !== "pending") {
      return NextResponse.json(
        { error: "ORDER_CANNOT_BE_CANCELLED" },
        { status: 400 }
      );
    }

    /* ================= UPDATE ITEMS ================= */

    await query(
      `
      update order_items
      set
        status='cancelled',
        seller_cancel_reason=$2
      where order_id=$1
      and status='pending'
      `,
      [orderId, cancelReason]
    );

    /* ================= UPDATE ORDER ================= */

    await query(
      `
      update orders
      set
        status='cancelled',
        cancel_reason=$2,
        cancelled_at=now()
      where id=$1
      `,
      [orderId, cancelReason]
    );

    return NextResponse.json({
      success: true
    });

  } catch (err) {

    console.error("ORDER CANCEL ERROR:", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
