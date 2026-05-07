import { NextRequest, NextResponse, waitUntil } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { markPaymentVerifying } from "@/lib/db/payments.submit";
import { runPaymentSettlement } from "@/lib/payments/payment.orchestrator";

/* =========================================================
   SAFE HELPERS
========================================================= */

function asText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* =========================================================
   ROUTE
========================================================= */

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  console.log("[PAYMENT][NOTIFY_COMPLETE_INCOMING]", {
    requestId,
    url: req.url,
    method: req.method,
  });

  try {
    /* =====================================================
       0. AUTH
    ===================================================== */

    const user = await getUserFromBearer();

    if (!user?.id) {
      console.log("[PAYMENT][NOTIFY_COMPLETE_AUTH_FAIL]", { requestId });

      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    /* =====================================================
       1. RAW BODY LOG (IMPORTANT DEBUG)
    ===================================================== */

    const rawText = await req.text();

    console.log("[PAYMENT][NOTIFY_COMPLETE_RAW_BODY]", {
      requestId,
      rawText,
    });

    const raw = safeJsonParse(rawText);

    if (!raw) {
      console.log("[PAYMENT][NOTIFY_COMPLETE_BAD_JSON]", {
        requestId,
      });

      return NextResponse.json(
        { ok: false, error: "INVALID_JSON" },
        { status: 400 }
      );
    }

    /* =====================================================
       2. EXTRACT FIELDS
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
       3. VALIDATION (SOFT - NO BLOCK DEBUG)
    ===================================================== */

    if (!paymentIntentId || !piPaymentId || !txid) {
      console.log("[PAYMENT][NOTIFY_COMPLETE_MISSING_FIELDS]", {
        requestId,
      });

      return NextResponse.json(
        { ok: false, error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    /* ⚠️ FIX: relax txid validation (Pi is inconsistent) */
    if (txid.length < 10) {
      console.log("[PAYMENT][NOTIFY_COMPLETE_INVALID_TXID]", {
        requestId,
        txid,
      });

      return NextResponse.json(
        { ok: false, error: "INVALID_TXID" },
        { status: 400 }
      );
    }

    /* =====================================================
       4. MAIN FLOW LOG
    ===================================================== */

    console.log("[PAYMENT][NOTIFY_COMPLETE_START]", {
      requestId,
      userId: user.id,
      paymentIntentId,
      piPaymentId,
      txid,
    });

    /* =====================================================
       5. MARK VERIFYING (SYNC)
    ===================================================== */

    const marked = await markPaymentVerifying({
      paymentIntentId,
      userId: user.id,
      piPaymentId,
      txid,
    });

    console.log("[PAYMENT][NOTIFY_COMPLETE_MARKED]", {
      requestId,
      marked,
    });

    /* =====================================================
       6. BACKGROUND SETTLEMENT
    ===================================================== */

    waitUntil(
      runPaymentSettlement({
        paymentIntentId,
        piPaymentId,
        txid,
        userId: user.id,
        source: "notify-complete",
      })
        .then((res) => {
          console.log("[PAYMENT][NOTIFY_COMPLETE_BG_DONE]", {
            requestId,
            res,
          });
        })
        .catch((err) => {
          console.error("[PAYMENT][NOTIFY_COMPLETE_BG_FAIL]", {
            requestId,
            err,
          });
        })
    );

    /* =====================================================
       7. RESPONSE
    ===================================================== */

    return NextResponse.json({
      ok: true,
      requestId,
      processing: true,
      status: "verifying",
    });
  } catch (err) {
    console.error("[PAYMENT][NOTIFY_COMPLETE_FATAL]", err);

    return NextResponse.json(
      {
        ok: false,
        error: "NOTIFY_COMPLETE_FAILED",
      },
      { status: 500 }
    );
  }
}
