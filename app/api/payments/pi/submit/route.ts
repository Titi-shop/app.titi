
import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { markPaymentVerifying } from "@/lib/db/payments.submit";
import { enqueueReconcileJob } from "@/lib/db/payment.jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  payment_intent_id: string;
  pi_payment_id: string;
  txid: string;
};

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]-[1-5][0-9a-f]-[89ab][0-9a-f]-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  console.log("🟡 [SUBMIT] START", { requestId });

  try {
    /* =========================
       AUTH
    ========================= */
    const auth = await getUserFromBearer();
    if (!auth) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    /* =========================
       BODY
    ========================= */
    const raw = await req.json().catch(() => null);

    const payment_intent_id = raw?.payment_intent_id?.trim();
    const pi_payment_id = raw?.pi_payment_id?.trim();
    const txid = raw?.txid?.trim();

    if (!payment_intent_id || !pi_payment_id) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    console.log("🟡 [SUBMIT] BODY_OK", {
      requestId,
      payment_intent_id,
      pi_payment_id,
    });

    /* =========================
       STEP 1: LOCK PAYMENT INTENT
    ========================= */
    console.log("🟡 [SUBMIT] LOCK_INTENT");

    await markPaymentVerifying({
      paymentIntentId: payment_intent_id,
      userId,
      piPaymentId: pi_payment_id,
      txid: txid || null,
    });

    console.log("🟢 [SUBMIT] LOCKED");

    /* =========================
       STEP 2: ENQUEUE RECONCILE JOB
    ========================= */
    console.log("🟡 [SUBMIT] ENQUEUE_JOB");

    const job = await enqueueReconcileJob({
      paymentIntentId: payment_intent_id,
      piPaymentId: pi_payment_id,
      txid,
      userId,
    });

    console.log("🟢 [SUBMIT] JOB_CREATED", {
      jobId: job.id,
    });

    /* =========================
       RESPONSE
    ========================= */
    return NextResponse.json({
      success: true,
      status: "processing",
      requestId,
      jobId: job.id,
    });
  } catch (err) {
    console.error("🔥 [SUBMIT] FAIL", err);

    return NextResponse.json(
      { error: "SUBMIT_FAILED" },
      { status: 500 }
    );
  }
}
