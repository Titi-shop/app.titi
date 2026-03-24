import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromBearer();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const { product_id, variant_id, quantity } = body;

    if (!product_id) {
      return NextResponse.json({ error: "Invalid product" }, { status: 400 });
    }

    // 👉 UPSERT
    await query(
      `
      insert into cart_items (user_id, product_id, variant_id, quantity)
      values ($1, $2, $3, $4)
      on conflict (user_id, product_id, variant_id)
      do update set
        quantity = cart_items.quantity + excluded.quantity,
        updated_at = now()
      `,
      [user.pi_uid, product_id, variant_id ?? null, quantity ?? 1]
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
