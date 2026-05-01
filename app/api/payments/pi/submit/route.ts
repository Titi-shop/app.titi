import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { markPaymentVerifying } from "@/lib/db/payments.submit";
import { reconcilePayment } from "@/lib/services/payment/reconcile.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmitBody = {
  payment_intent_id: string;
  pi_payment_id: string;
  txid: string;
};

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseBody(raw: unknown): SubmitBody | null {
  if (!isRecord(raw)) return null;

  const paymentIntentId =
    typeof raw.payment_intent_id === "string"
      ? raw.payment_intent_id.trim()
      : "";

  const piPaymentId =
    typeof raw.pi_payment_id === "string"
      ? raw.pi_payment_id.trim()
      : "";

  const txid =
    typeof raw.txid === "string"
      ? raw.txid.trim()
      : "";

  if (!isUUID(paymentIntentId) || !piPaymentId || !txid) {
    return null;
  }

  return {
    payment_intent_id: paymentIntentId,
    pi_payment_id: piPaymentId,
    txid,
  };
}

export async function POST(req: Request) {
  try {
    console.log("[PAYMENT][SUBMIT] START");

    const auth = await getUserFromBearer();

    if (!auth) {
      console.warn("[PAYMENT][SUBMIT] UNAUTHORIZED");
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    const raw = await req.json().catch(() => null);
    const body = parseBody(raw);

    if (!body) {
      console.warn("[PAYMENT][SUBMIT] INVALID_BODY");
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const { payment_intent_id, pi_payment_id, txid } = body;

    console.log("[PAYMENT][SUBMIT] LOCK_VERIFYING", {
      payment_intent_id,
      pi_payment_id,
      txid,
    });

    /**
     * 1. Mark intent as verifying (DB lock)
     */
    await markPaymentVerifying({
      paymentIntentId: payment_intent_id,
      userId,
      piPaymentId: pi_payment_id,
      txid,
    });

    /**
     * 2. CALL RECONCILE DIRECTLY (NO HTTP FETCH ❌)
     */
    console.log("[PAYMENT][SUBMIT] RECONCILE_START");

    const result = await reconcilePayment({
  userId,
  paymentIntentId,
  piPaymentId,
  txid,
});

    console.log("[PAYMENT][SUBMIT] RECONCILE_DONE", {
      ok: result?.success,
      orderId: result?.order_id,
    });

    /**
     * 3. RETURN FINAL RESULT
     */
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("[PAYMENT][SUBMIT] FAIL", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "SUBMIT_FAILED",
      },
      { status: 500 }
    );
  }
}
