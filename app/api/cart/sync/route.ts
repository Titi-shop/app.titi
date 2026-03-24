import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

type CartItemInput = {
  product_id: string;
  variant_id?: string;
  quantity: number;
};

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromBearer();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items: CartItemInput[] = await req.json();

    for (const item of items) {
      await query(
        `
        insert into cart_items (user_id, product_id, variant_id, quantity)
        values ($1, $2, $3, $4)
        on conflict (user_id, product_id, variant_id)
        do update set
          quantity = cart_items.quantity + excluded.quantity,
          updated_at = now()
        `,
        [
          user.pi_uid,
          item.product_id,
          item.variant_id ?? null,
          item.quantity ?? 1,
        ]
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
