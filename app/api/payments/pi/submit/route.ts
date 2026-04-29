import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { markPaymentVerifying } from "@/lib/db/payments.submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

type Body = {
  payment_intent_id?: unknown;
  pi_payment_id?: unknown;
  txid?: unknown;
};

export async function POST(req: Request) {
  try {
    console.log("🟡 [SUBMIT] START");

    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    const raw = await req.json().catch(() => null);

    console.log("🟡 [SUBMIT] RAW_BODY", raw);

    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const paymentIntentId =
      typeof (raw as any).payment_intent_id === "string"
        ? (raw as any).payment_intent_id.trim()
        : "";

    const piPaymentId =
      typeof (raw as any).pi_payment_id === "string"
        ? (raw as any).pi_payment_id.trim()
        : "";

    const txid =
      typeof (raw as any).txid === "string"
        ? (raw as any).txid.trim()
        : "";

    if (!isUUID(paymentIntentId) || !piPaymentId) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    console.log("🟡 [SUBMIT] CALL_DB");

    const result = await markPaymentVerifying({
      paymentIntentId,
      userId,
      piPaymentId,
      txid: txid || null,
    });

    console.log("🟢 [SUBMIT] MARKED_VERIFYING", result);

    /**
     * 🔥 IMPORTANT FIX:
     * fire reconcile async server-side
     * không phụ thuộc client callback
     */
    queueMicrotask(async () => {
      try {
        console.log("🟡 [SUBMIT] AUTO_RECONCILE_TRIGGER");

        await fetch(`${process.env.APP_URL}/api/payments/pi/reconcile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: req.headers.get("authorization") || "",
          },
          body: JSON.stringify({
            payment_intent_id: paymentIntentId,
            pi_payment_id: piPaymentId,
            txid,
          }),
        });

        console.log("🟢 [SUBMIT] AUTO_RECONCILE_DONE");
      } catch (e) {
        console.error("🔥 [SUBMIT] AUTO_RECONCILE_FAIL", e);
      }
    });

    return NextResponse.json({
      success: true,
      status: "verifying",
      paymentIntentId,
    });
  } catch (err) {
    console.error("🔥 [SUBMIT] CRASH", err);

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "SUBMIT_FAILED" },
      { status: 400 }
    );
  }
}
