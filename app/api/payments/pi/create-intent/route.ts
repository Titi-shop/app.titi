import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { createPiPaymentIntent } from "@/lib/db/payments.intent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUUID(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function safeQty(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return 1;
  return Math.min(n, 10);
}

export async function POST(req: Request) {
  try {
    const auth = await getUserFromBearer();
    if (!auth) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const productId = body.product_id;
    const variantId = body.variant_id ?? null;
    const quantity = safeQty(body.quantity);

    if (!isUUID(productId)) {
      return NextResponse.json({ error: "INVALID_PRODUCT_ID" }, { status: 400 });
    }

    const intent = await createPiPaymentIntent({
      userId,
      productId,
      variantId,
      quantity,
      country: body.country,
      zone: body.zone,
      shipping: body.shipping,
    });

    return NextResponse.json(intent);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "CREATE_INTENT_FAILED" },
      { status: 400 }
    );
  }
}
