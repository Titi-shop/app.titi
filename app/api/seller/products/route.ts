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
    /* ================= AUTH + RBAC ================= */
    const auth = await requireSeller();

    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= DB ================= */
    const products = (await getSellerProducts(userId)) as SellerProduct[];

    return NextResponse.json(products);

  } catch (err) {
    console.warn("SELLER PRODUCTS WARN:", err);
    return NextResponse.json([], { status: 200 });
  }
}
