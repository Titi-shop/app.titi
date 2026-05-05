import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { piAuthorizePayment } from "@/lib/pi/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  paymentIntentId?: string;
  payment_intent_id?: string;
  piPaymentId?: string;
  pi_payment_id?: string;
};

export async function POST(req: Request) {
  const auth = await getUserFromBearer();

  if (!auth) {
    return NextResponse.json(
      { error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  let body: Body = {};

  try {
    body = await req.json();
  } catch {}

  const paymentIntentId =
    body.paymentIntentId ?? body.payment_intent_id;

  const piPaymentId =
    body.piPaymentId ?? body.pi_payment_id;

  if (!paymentIntentId || !piPaymentId) {
    return NextResponse.json(
      { error: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  try {
    const result = await piAuthorizePayment({
      userId: auth.userId,
      paymentIntentId,
      piPaymentId,
      authorizationHeader:
        req.headers.get("authorization") || "",
    });

    return NextResponse.json(result);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "AUTHORIZE_FAILED";

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
