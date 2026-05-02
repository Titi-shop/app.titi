
import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import { markPaymentVerifying } from "@/lib/db/payments.submit";
import { enqueueReconcileJob } from "@/lib/db/payment.jobs";

import { runPaymentSettlement } from "@/lib/payments/payment.orchestrator";

import type {
  SubmitPaymentBody,
} from "@/lib/payments/payment.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   HELPERS
========================================================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseBody(raw: unknown): SubmitPaymentBody | null {
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

/* =========================================================
   POST
========================================================= */

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  console.log("[PAYMENT][SUBMIT] START", { requestId });

  try {
    /* =====================================================
       AUTH
    ===================================================== */

    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    /* =====================================================
       BODY
    ===================================================== */

    const raw = await req.json().catch(() => null);
    const body = parseBody(raw);

    if (!body) {
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

    console.log("[PAYMENT][SUBMIT] BODY_OK", {
      requestId,
      payment_intent_id,
      pi_payment_id,
      txid,
    });

    /* =====================================================
       STEP 1 — LOCK PAYMENT INTO VERIFYING
    ===================================================== */

    await markPaymentVerifying({
      paymentIntentId: payment_intent_id,
      userId,
      piPaymentId: pi_payment_id,
      txid,
    });

    console.log("[PAYMENT][SUBMIT] VERIFYING_LOCKED");

    /* =====================================================
       STEP 2 — ENQUEUE BACKGROUND JOB
    ===================================================== */

    const job = await enqueueReconcileJob({
      paymentIntentId: payment_intent_id,
      piPaymentId: pi_payment_id,
      txid,
      userId,
    });

    console.log("[PAYMENT][SUBMIT] JOB_ENQUEUED", {
      jobId: job.id,
    });

    /* =====================================================
       STEP 3 — FIRE AND FORGET ORCHESTRATOR
       do not await
    ===================================================== */

    void runPaymentSettlement({
      paymentIntentId: payment_intent_id,
      piPaymentId: pi_payment_id,
      txid,
      source: "client_submit",
      userId,
    }).catch((err: unknown) => {
      console.error("[PAYMENT][SUBMIT] ASYNC_SETTLEMENT_FAIL", err);
    });

    console.log("[PAYMENT][SUBMIT] ENGINE_TRIGGERED");

    /* =====================================================
       FAST RESPONSE TO CLIENT
    ===================================================== */

    return NextResponse.json({
      success: true,
      status: "processing",
      requestId,
      jobId: job.id,
    });
  } catch (err: unknown) {
    console.error("[PAYMENT][SUBMIT] FAIL", err);

    return NextResponse.json(
      { error: "SUBMIT_FAILED" },
      { status: 500 }
    );
  }
}
