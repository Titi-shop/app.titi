import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getPiUserFromToken } from "@/lib/piAuth";

export const dynamic = "force-dynamic";

/* =========================
ORDER
========================= */

type OrderRow = {
  id: string;
  order_number: string;
  buyer_id: string;

  status: string;
  total: number;

  created_at: string;
};

/* =========================
ORDER ITEM
========================= */
type OrderItemRow = {
  id: string;
  order_id: string;
  created_at: string;
  product_id: string | null;
  seller_id: string;

  product_name: string;
  thumbnail: string;

  unit_price: number;
  quantity: number;
  total_price: number;

  status: string;

  seller_message: string | null;
  seller_cancel_reason: string | null;
};

/* =========================
GET ORDERS
========================= */

export async function GET(req: NextRequest) {
  try {

    /* =========================
       AUTH
    ========================= */

    const user = await getPiUserFromToken(req);

if (!user) {
  return NextResponse.json(
    { error: "UNAUTHENTICATED" },
    { status: 401 }
  );
}

// ✅ THÊM Ở ĐÂY
const userRes = await query(
  `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
  [user.pi_uid]
);

if (userRes.rowCount === 0) {
  return NextResponse.json({ orders: [] });
}

const userId = userRes.rows[0].id;
    /* =========================
       LOAD ORDERS
    ========================= */

    const { rows: orders } = await query<OrderRow>(
      `
      select
        id,
        order_number,
        buyer_id,
        status,
        total,
        created_at
      from orders
      where buyer_id=$1
      order by created_at desc
      `,
      [userId]
    );

    if (orders.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    const orderIds = orders.map((o) => o.id);

    /* =========================
       LOAD ORDER ITEMS
    ========================= */

    const { rows: items } = await query<OrderItemRow>(
  `
  select
    id,
    order_id,
    product_id,
    seller_id,
    product_name,
    thumbnail,
    unit_price,
    quantity,
    total_price,
    status,
    seller_message,
    seller_cancel_reason
  from order_items
  where order_id = any($1::uuid[])
  order by created_at asc
  `,
  [orderIds]
);

    /* =========================
       GROUP ITEMS
    ========================= */

    const map = new Map<string, OrderItemRow[]>();

    for (const item of items) {

      if (!map.has(item.order_id)) {
        map.set(item.order_id, []);
      }

      map.get(item.order_id)!.push(item);
    }

    /* =========================
       BUILD RESPONSE
    ========================= */

    const result = orders.map((order) => {

  const orderItems = map.get(order.id) ?? [];


  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    total: Number(order.total),
    created_at: order.created_at,
    order_items: orderItems
  };

});

    return NextResponse.json({
      orders: result
    });

  } catch (err) {

    console.error("ORDERS API ERROR:", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
