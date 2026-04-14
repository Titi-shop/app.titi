import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { getSellerProducts } from "@/lib/db/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SellerProduct = {
  id: string;
  name: string;
  price: number;
  thumbnail: string | null;
  images: string[] | null;
  sale_price: number | null;
  sale_start: string | null;
  sale_end: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export async function GET() {
  try {
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= DB ================= */
    const products = await getSellerProducts(userId);

    /* 🔥 FIX: attach min variant price */
    const enriched = await Promise.all(
      products.map(async (p: any) => {
        // 👉 lấy variants của product
        const { rows: variants } = await query<{
          price: number;
          sale_price: number | null;
        }>(
          `
          SELECT price, sale_price
          FROM product_variants
          WHERE product_id = $1
          `,
          [p.id]
        );

        let minPrice = p.price ?? 0;
        let minSale: number | null = null;

        if (variants.length > 0) {
          const prices = variants
            .map((v) => Number(v.price))
            .filter((v) => v > 0);

          const sales = variants
            .map((v) => Number(v.sale_price))
            .filter((v) => v > 0);

          if (prices.length > 0) {
            minPrice = Math.min(...prices);
          }

          if (sales.length > 0) {
            minSale = Math.min(...sales);
          }
        }

        return {
          ...p,

          /* 🔥 thêm */
          min_price: minPrice,
          min_sale_price: minSale,
        };
      })
    );

    return NextResponse.json(enriched);

  } catch (err) {
    console.warn("SELLER PRODUCTS WARN:", err);
    return NextResponse.json([], { status: 200 });
  }
}
