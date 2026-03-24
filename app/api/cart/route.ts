import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

type CartRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;

  name: string | null;
  price: number | null;
  final_price: number | null;
  thumbnail: string | null;

  stock: number | null;
};

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromBearer(req);

    console.log("USER:", user);

    if (!user?.pi_uid) {
      return NextResponse.json([]);
    }

    const result = await query(
      `
      select 
        c.id,
        c.product_id,
        c.variant_id,
        c.quantity,

        p.name,
        p.price,
        p.final_price,
        p.thumbnail,
        p.stock

      from cart_items c
      left join products p on p.id = c.product_id

      where c.buyer_id = $1
      order by c.created_at desc
      `,
      [user.pi_uid]
    );

    const rows = result.rows as CartRow[];

    console.log("ROWS:", rows);

    const items = rows
      .filter((r) => r.product_id)
      .map((r) => ({
        id: r.variant_id
          ? `${r.product_id}-${r.variant_id}`
          : r.product_id,

        product_id: r.product_id,
        variant_id: r.variant_id,

        name: r.name ?? "Unknown product",

        price: Number(r.price ?? 0),
        sale_price:
          typeof r.final_price === "number"
            ? Number(r.final_price)
            : null,

        thumbnail: r.thumbnail ?? "",

        stock: r.stock ?? 0,

        quantity: r.quantity ?? 1,
      }));

    return NextResponse.json(items);
  } catch (err) {
    console.error("❌ CART GET ERROR:", err);
    return NextResponse.json([], { status: 500 });
  }
}
