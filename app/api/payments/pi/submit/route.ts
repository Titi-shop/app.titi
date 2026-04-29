import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { markPaymentVerifying } from "@/lib/db/payments.submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUUID(v: unknown): v is string {
  return typeof v === "string" && v.length > 10;
}

export async function POST(req: Request) {
  try {
    const auth = await getUserFromBearer();
    if (!auth) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;
    const body = await req.json();

    const paymentIntentId = body.payment_intent_id;
    const piPaymentId = body.pi_payment_id;

    if (!isUUID(paymentIntentId) || !piPaymentId) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const result = await markPaymentVerifying({
      paymentIntentId,
      userId,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "SUBMIT_FAILED" },
      { status: 400 }
    );
  }
}
