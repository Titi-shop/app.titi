
import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { markPaymentVerifying } from "@/lib/db/payments.submit";

import type { SubmitPaymentBody } from "@/lib/payments/payment.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   SAFE HELPERS
========================================================= */

function isUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseBody(raw: unknown): SubmitPaymentBody | null {
  if (!isRecord(raw)) {
    return null;
  }

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

  if (!isUUID(paymentIntentId) || piPaymentId.length === 0 || txid.length === 0) {
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
      console.warn("[PAYMENT][SUBMIT] UNAUTHORIZED", { requestId });

      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          requestId,
        },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    /* =====================================================
       BODY
    ===================================================== */

    const raw: unknown = await req.json().catch(() => null);
    const body = parseBody(raw);

    if (!body) {
      console.warn("[PAYMENT][SUBMIT] INVALID_BODY", {
        requestId,
      });

      return NextResponse.json(
        {
          success: false,
          error: "INVALID_BODY",
          requestId,
        },
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
       ONLY LOCK VERIFYING STATE
       NO ORCHESTRATOR
       NO PAYMENT JOB QUEUE
    ===================================================== */

    const verifying = await markPaymentVerifying({
      paymentIntentId: payment_intent_id,
      userId,
      piPaymentId: pi_payment_id,
      txid,
    });

    console.log("[PAYMENT][SUBMIT] VERIFYING_LOCKED", {
      requestId,
      verifying,
    });

    /* =====================================================
       FAST RETURN
       CLIENT WILL CALL /reconcile AFTER THIS
    ===================================================== */

    return NextResponse.json({
      success: true,
      requestId,
      status: "processing",
      payment_intent_id,
    });
  } catch (error: unknown) {
    console.error("[PAYMENT][SUBMIT] FAIL", {
      requestId,
      error,
    });

    return NextResponse.json(
      {
        success: false,
        error: "SUBMIT_FAILED",
        requestId,
      },
      { status: 500 }
    );
  }
}
