import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { markPaymentVerifying } from "@/lib/db/payments.submit";
import { enqueueReconcileJob } from "@/lib/db/payment.jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmitBody = {
  payment_intent_id: string;
  pi_payment_id: string;
  txid: string;
};

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

  if (!paymentIntentId || !piPaymentId || !txid) return null;

  return {
    payment_intent_id: paymentIntentId,
    pi_payment_id: piPaymentId,
    txid,
  };
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  console.log("🟡 [PAYMENT][SUBMIT] START", { requestId });

  try {
    /* =========================
       AUTH CHECK
    ========================= */
    const auth = await getUserFromBearer();

    if (!auth) {
      console.warn("🔴 [PAYMENT][SUBMIT] UNAUTHORIZED", { requestId });

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
    const raw = await req.json().catch((e) => {
      console.error("🔥 [PAYMENT][SUBMIT] INVALID_JSON", {
        requestId,
        error: e,
      });
      return null;
    });

    const body = parseBody(raw);

    if (!body) {
      console.warn("🟠 [PAYMENT][SUBMIT] INVALID_BODY", {
        requestId,
        raw,
      });

      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const {
      payment_intent_id,
      pi_payment_id,
      txid,
    } = body;

    console.log("🟡 [PAYMENT][SUBMIT] BODY_PARSED", {
      requestId,
      payment_intent_id,
      pi_payment_id,
      txid,
    });

    /* =========================
       STEP 1 - MARK VERIFYING
    ========================= */
    console.log("🟡 [PAYMENT][SUBMIT] STEP1_MARK_VERIFYING");

    await markPaymentVerifying({
      paymentIntentId: payment_intent_id,
      userId,
      piPaymentId: pi_payment_id,
      txid,
    });

    console.log("🟢 [PAYMENT][SUBMIT] MARK_VERIFYING_OK", {
      requestId,
    });

    /* =========================
       STEP 2 - ENQUEUE RECONCILE JOB
    ========================= */
    console.log("🟡 [PAYMENT][SUBMIT] STEP2_ENQUEUE_JOB");

    const job = await enqueueReconcileJob({
      paymentIntentId: payment_intent_id,
      piPaymentId: pi_payment_id,
      txid,
    });

    console.log("🟢 [PAYMENT][SUBMIT] JOB_ENQUEUED", {
      requestId,
      jobId: job?.id,
    });

    /* =========================
       RESPONSE
    ========================= */
    console.log("🟢 [PAYMENT][SUBMIT] DONE", {
      requestId,
      status: "processing",
    });

    return NextResponse.json({
      success: true,
      status: "processing",
      request_id: requestId,
    });
  } catch (err) {
    console.error("🔥 [PAYMENT][SUBMIT] FAIL", {
      error: err,
    });

    return NextResponse.json(
      { error: "SUBMIT_FAILED" },
      { status: 500 }
    );
  }
}
