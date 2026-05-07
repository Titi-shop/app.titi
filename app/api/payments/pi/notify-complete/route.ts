// app/api/payments/pi/notify-complete/route.ts

import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";

import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import { getPaymentIntentById } from "@/lib/db/payment_intents";
import { markPaymentVerifying } from "@/lib/db/payments.submit";

import { runPaymentSettlement } from "@/lib/payments/payment.orchestrator";

/* =========================================================
   CONFIG
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type NotifyCompleteBody = {
  payment_intent_id?: unknown;
  pi_payment_id?: unknown;
  txid?: unknown;
};

/* =========================================================
   HELPERS
========================================================= */

function asText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeJsonParse(text: string): NotifyCompleteBody | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

/* =========================================================
   ROUTE
========================================================= */

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  console.log("[PAYMENT][NOTIFY_COMPLETE_INCOMING]", {
    requestId,
    method: req.method,
    url: req.url,
  });

  try {
    /* =====================================================
       1. AUTH
    ===================================================== */

    const auth = await getUserFromBearer();

    if (!auth?.userId) {
      console.error("[PAYMENT][NOTIFY_COMPLETE_AUTH_FAIL]", {
        requestId,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "UNAUTHORIZED",
          requestId,
        },
        { status: 401 }
      );
    }

    /* =====================================================
       2. RAW BODY
    ===================================================== */

    const rawText = await req.text();

    console.log("[PAYMENT][NOTIFY_COMPLETE_RAW_BODY]", {
      requestId,
      rawText,
    });

    const raw = safeJsonParse(rawText);

    if (!raw) {
      console.error("[PAYMENT][NOTIFY_COMPLETE_INVALID_JSON]", {
        requestId,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_JSON",
          requestId,
        },
        { status: 400 }
      );
    }

    /* =====================================================
       3. NORMALIZE
    ===================================================== */

    const paymentIntentId = asText(raw.payment_intent_id);

    const piPaymentId = asText(raw.pi_payment_id);

    const txid = asText(raw.txid);

    console.log("[PAYMENT][NOTIFY_COMPLETE_PARSED]", {
      requestId,
      paymentIntentId,
      piPaymentId,
      txid,
    });

    /* =====================================================
       4. VALIDATION
    ===================================================== */

    if (!paymentIntentId || !piPaymentId || !txid) {
      console.error("[PAYMENT][NOTIFY_COMPLETE_MISSING_FIELDS]", {
        requestId,
        paymentIntentId,
        piPaymentId,
        txid,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_FIELDS",
          requestId,
        },
        { status: 400 }
      );
    }

    if (!isUUID(paymentIntentId)) {
      console.error("[PAYMENT][NOTIFY_COMPLETE_INVALID_INTENT]", {
        requestId,
        paymentIntentId,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_PAYMENT_INTENT_ID",
          requestId,
        },
        { status: 400 }
      );
    }

    if (txid.length < 10) {
      console.error("[PAYMENT][NOTIFY_COMPLETE_INVALID_TXID]", {
        requestId,
        txid,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_TXID",
          requestId,
        },
        { status: 400 }
      );
    }

    /* =====================================================
       5. PAYMENT INTENT CHECK
    ===================================================== */

    const intent = await getPaymentIntentById(paymentIntentId);

    if (!intent) {
      console.error("[PAYMENT][NOTIFY_COMPLETE_INTENT_NOT_FOUND]", {
        requestId,
        paymentIntentId,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "PAYMENT_INTENT_NOT_FOUND",
          requestId,
        },
        { status: 404 }
      );
    }

    if (intent.user_id !== auth.userId) {
      console.error("[PAYMENT][NOTIFY_COMPLETE_OWNER_MISMATCH]", {
        requestId,
        paymentIntentId,
        authUserId: auth.userId,
        intentUserId: intent.user_id,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "FORBIDDEN",
          requestId,
        },
        { status: 403 }
      );
    }

    /* =====================================================
       6. MARK VERIFYING
    ===================================================== */

    console.log("[PAYMENT][NOTIFY_COMPLETE_MARK_VERIFYING_START]", {
      requestId,
      paymentIntentId,
    });

    const marked = await markPaymentVerifying({
      paymentIntentId,
      userId: auth.userId,
      piPaymentId,
      txid,
    });

    console.log("[PAYMENT][NOTIFY_COMPLETE_MARK_VERIFYING_OK]", {
      requestId,
      marked,
    });

    /* =====================================================
       7. BACKGROUND SETTLEMENT
    ===================================================== */

    waitUntil(
      runPaymentSettlement({
        paymentIntentId,
        piPaymentId,
        txid,
        userId: auth.userId,
        source: "notify-complete",
      })
        .then((result) => {
          console.log("[PAYMENT][NOTIFY_COMPLETE_SETTLEMENT_OK]", {
            requestId,
            result,
          });
        })
        .catch((error) => {
          console.error("[PAYMENT][NOTIFY_COMPLETE_SETTLEMENT_FAIL]", {
            requestId,
            error,
          });
        })
    );

    /* =====================================================
       8. RESPONSE
    ===================================================== */

    return NextResponse.json({
      ok: true,
      requestId,
      processing: true,
      status: "verifying",
      payment_intent_id: paymentIntentId,
    });
  } catch (error) {
    console.error("[PAYMENT][NOTIFY_COMPLETE_FATAL]", {
      requestId,
      error,
    });

    return NextResponse.json(
      {
        ok: false,
        error: "NOTIFY_COMPLETE_FAILED",
        requestId,
      },
      { status: 500 }
    );
  }
}
