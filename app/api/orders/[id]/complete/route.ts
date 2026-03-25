import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getPiUserFromToken } from "@/lib/piAuth";
import { resolveRole } from "@/lib/auth/resolveRole";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* =====================================================
PATCH /api/orders/[id]/complete
Customer confirm received
shipping → completed
===================================================== */

async function completeOrder(
  req: NextRequest,
  params: { id: string }
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

    const role = await resolveRole(user);

    if (role === "guest") {
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

    /* ================= CHECK ORDER ================= */

    const { rows } = await query(
      `
      select id,status
      from orders
      where id=$1
      and buyer_id=$2
      `,
      [orderId, userId]
    );

    const order = rows[0];

    if (!order) {
      return NextResponse.json(
        { error: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (order.status !== "shipping") {
      return NextResponse.json(
        { error: "INVALID_STATUS_TRANSITION" },
        { status: 400 }
      );
    }

    /* ================= UPDATE ITEMS ================= */

    const { rowCount } = await query(
      `
      update order_items
      set
        status='completed',
        delivered_at=now()
      where order_id=$1
      and status='shipping'
      `,
      [orderId]
    );

    if (!rowCount) {
      return NextResponse.json(
        { error: "NO_ITEMS_UPDATED" },
        { status: 400 }
      );
    }

    /* ================= DONE ================= */

    return NextResponse.json({
      success: true,
      message: "ORDER_COMPLETED"
    });

  } catch (err) {

    console.error("ORDER COMPLETE ERROR:", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

/* ================= METHODS ================= */

export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  return completeOrder(req, ctx.params);
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  return completeOrder(req, ctx.params);
}
