import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const userId = auth.userId;
  const returnId = params.id;

  /* ================= LOAD RETURN ================= */

  const { rows } = await query<{
    refund_amount: string;
    status: string;
    order_id: string;
  }>(
    `
    SELECT refund_amount, status, order_id
    FROM returns
    WHERE id = $1
    LIMIT 1
    `,
    [returnId]
  );

  const ret = rows[0];

  if (!ret) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (ret.status !== "refund_pending") {
    return NextResponse.json(
      { error: "INVALID_STATE" },
      { status: 400 }
    );
  }

  /* ================= LOAD BUYER ================= */

  const { rows: orderRows } = await query<{
    buyer_id: string;
  }>(
    `
    SELECT buyer_id
    FROM orders
    WHERE id = $1
    LIMIT 1
    `,
    [ret.order_id]
  );

  const buyerId = orderRows[0]?.buyer_id;

  if (!buyerId) {
    return NextResponse.json(
      { error: "BUYER_NOT_FOUND" },
      { status: 400 }
    );
  }

  /* ================= LOAD PI UID ================= */

  const { rows: userRows } = await query<{
    pi_uid: string;
  }>(
    `
    SELECT pi_uid
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [buyerId]
  );

  const piUid = userRows[0]?.pi_uid;

  if (!piUid) {
    return NextResponse.json(
      { error: "PI_USER_NOT_FOUND" },
      { status: 400 }
    );
  }

  /* ================= CREATE PI PAYMENT ================= */

  const res = await fetch(`${process.env.PI_API_URL}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Key ${process.env.PI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Number(ret.refund_amount),
      memo: `Refund ${returnId}`,
      metadata: {
        type: "refund",
        return_id: returnId,
      },
      uid: piUid,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: "PI_CREATE_FAILED" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    paymentId: data.identifier,
  });
}
