import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { getSellerOrders } from "@/lib/db/orders";
import { resolveRole } from "@/lib/auth/resolveRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "cancelled"
  | "returned";

function parseOrderStatus(v: string | null): OrderStatus | undefined {

  if (!v) return;

  const allowed: OrderStatus[] = [
    "pending",
    "confirmed",
    "shipping",
    "completed",
    "cancelled",
    "returned",
  ];

  return allowed.includes(v as OrderStatus)
    ? (v as OrderStatus)
    : undefined;
}

export async function GET(req: Request) {

  try {

    const user = await getUserFromBearer(req);

    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }
    
export async function GET(req: Request) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= QUERY ================= */
    const { searchParams } = new URL(req.url);

    const status = parseOrderStatus(searchParams.get("status"));
    const page = Number(searchParams.get("page") ?? "1");

    /* ================= DB ================= */
    const orders = await getSellerOrders(
      userId,
      status,
      page
    );

    return NextResponse.json(orders);

  } catch (err) {
    console.error("SELLER ORDERS ERROR:", err);
    return NextResponse.json([], { status: 200 });
  }
}
