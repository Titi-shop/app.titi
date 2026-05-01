import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { markPaymentVerifying } from "@/lib/db/payments.submit";
import { enqueueReconcileJob } from "@/lib/db/payment.jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================
   TYPES
========================= */

type SubmitBody = {
  payment_intent_id: string;
  pi_payment_id: string;
  txid: string;
};

/* =========================
   VALIDATION
========================= */

function isUUID(v: string) {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

/* =========================
   MAIN
========================= */

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  console.log("🟡 [PAYMENT][SUBMIT] START", { requestId });

  try {
    /* =========================
       AUTH (NETWORK-FIRST)
    ========================= */

    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    console.log("🟢 [PAYMENT][SUBMIT] AUTH_OK", {
      requestId,
      userId,
    });

    /* =========================
       PARSE BODY
    ========================= */

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
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

    /* =========================
       VALIDATION
    ========================= */

    if (!isUUID(paymentIntentId)) {
      return NextResponse.json(
        { error: "INVALID_PAYMENT_INTENT" },
        { status: 400 }
      );
    }

    if (!piPaymentId || !txid) {
      return NextResponse.json(
        { error: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    console.log("🟡 [PAYMENT][SUBMIT] BODY_OK", {
      paymentIntentId,
      piPaymentId,
      txid,
    });

    /* =========================
       STEP 1 — LOCK PAYMENT INTENT
    ========================= */

    console.log("🟡 [PAYMENT][SUBMIT] LOCKING_INTENT");

    await markPaymentVerifying({
      paymentIntentId,
      userId,
      piPaymentId,
      txid,
    });

    console.log("🟢 [PAYMENT][SUBMIT] INTENT_LOCKED");

    /* =========================
       STEP 2 — ENQUEUE RECONCILE JOB
    ========================= */

    console.log("🟡 [PAYMENT][SUBMIT] ENQUEUE_JOB");

    const job = await enqueueReconcileJob({
      paymentIntentId,
      piPaymentId,
      txid,
      userId,
    });

    console.log("🟢 [PAYMENT][SUBMIT] JOB_CREATED", {
      jobId: job.id,
    });

    /* =========================
       RESPONSE (FAST RETURN)
    ========================= */

    return NextResponse.json({
      success: true,
      status: "processing",
      requestId,
      jobId: job.id,
    });
  } catch (err) {
    console.error("🔥 [PAYMENT][SUBMIT] FAIL", err);

    return NextResponse.json(
      { error: "SUBMIT_FAILED" },
      { status: 500 }
    );
  }
}
