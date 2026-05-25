import { NextResponse } from "next/server";

import { requireSeller } from "@/lib/auth/guard";
import { getSellerProducts } from "@/lib/db/products";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type SellerProductResponse = {
  id: string;
  name: string;
  price: number;
  sale_price: number | null;
  sale_start: string | null;
  sale_end: string | null;
  thumbnail: string | null;
  images: string[];
  stock: number;
  sold: number;
  rating_avg: number;
  is_active: boolean;
  min_price?: number;
  min_sale_price?: number | null;

  /* SHOP */
  shop_name: string | null;
  shop_banner: string | null;
  avatar_url: string | null;
  total_sales: number;
};

export async function GET() {
  try {
    const auth = await requireSeller();
    if (!auth.ok) {
      return auth.response;
    }

    const productsRaw = await getSellerProducts(auth.userId);
    const products: SellerProductResponse[] = productsRaw.map((p) => {
      const row = p as Record<string, unknown>;

      return {
        id: String(row.id ?? ""),
        name: String(row.name ?? ""),
        price: Number(row.price ?? 0),
        sale_price:
          typeof row.sale_price === "number"
            ? row.sale_price
            : null,
        sale_start:
          typeof row.sale_start === "string"
            ? row.sale_start
            : null,
        sale_end:
          typeof row.sale_end === "string"
            ? row.sale_end
            : null,
        thumbnail:
          typeof row.thumbnail === "string"
            ? row.thumbnail
            : null,
        images: Array.isArray(row.images)
          ? row.images.filter(
              (v): v is string => typeof v === "string"
            )
          : [],

        stock: Number(row.stock ?? 0),
        sold: Number(row.sold ?? 0),
        rating_avg: Number(row.rating_avg ?? 0),
        is_active: Boolean(row.is_active),
        min_price:
          typeof row.min_price === "number"
            ? row.min_price
            : undefined,

        min_sale_price:
          typeof row.min_sale_price === "number"
            ? row.min_sale_price
            : null,

        /* ================= SHOP ================= */

        shop_name:
          typeof row.shop_name === "string"
            ? row.shop_name
            : null,

        shop_banner:
          typeof row.shop_banner === "string"
            ? row.shop_banner
            : null,

        avatar_url:
          typeof row.avatar_url === "string"
            ? row.avatar_url
            : null,

        total_sales: Number(row.total_sales ?? 0),
      };
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("SELLER_PRODUCTS_ERROR:", error);

    return NextResponse.json([], {
      status: 200,
    });
  }
}
