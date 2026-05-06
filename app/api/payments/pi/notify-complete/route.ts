import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { markPaymentVerifying } from "@/lib/db/payments.submit";
import { runPaymentSettlement } from "@/lib/payments/payment.orchestrator";
import { waitUntil } from "@vercel/functions";

/* =========================================================
   TYPES
========================================================= */

type NotifyBody = {
  payment_intent_id?: unknown;
  pi_payment_id?: unknown;
  txid?: unknown;
};

function asText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isValidTxid(v: string): boolean {
  return /^[a-f0-9]{64}$/i.test(v);
}

/* =========================================================
   ROUTE
========================================================= */

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromBearer(req);

    if (!user?.id) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const raw = (await req.json().catch(() => null)) as NotifyBody | null;

    if (!raw) {
      return NextResponse.json(
        { ok: false, error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const paymentIntentId = asText(raw.payment_intent_id);
    const piPaymentId = asText(raw.pi_payment_id);
    const txid = asText(raw.txid);

    if (!paymentIntentId || !piPaymentId || !txid) {
      return NextResponse.json(
        { ok: false, error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    if (!isValidTxid(txid)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_TXID" },
        { status: 400 }
      );
    }

    console.log("[PAYMENT][NOTIFY_COMPLETE_START]", {
      userId: user.id,
      paymentIntentId,
      piPaymentId,
      txid,
    });

    /* =====================================================
       1. FAST MARK VERIFYING (SYNC)
    ===================================================== */

    const marked = await markPaymentVerifying({
      paymentIntentId,
      userId: user.id,
      piPaymentId,
      txid,
    });

    console.log("[PAYMENT][NOTIFY_COMPLETE_MARKED]", marked);

    /* =====================================================
       2. SAFE BACKGROUND SETTLEMENT (Vercel WAITUNTIL)
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
          console.log("[PAYMENT][NOTIFY_COMPLETE_BG_DONE]", res);
        })
        .catch((err) => {
          console.error("[PAYMENT][NOTIFY_COMPLETE_BG_FAIL]", err);
        })
    );

    /* =====================================================
       3. RETURN IMMEDIATELY
    ===================================================== */

    return NextResponse.json({
      ok: true,
      processing: true,
      payment_intent_id: paymentIntentId,
      status: "verifying",
    });
  } catch (e) {
    console.error("[PAYMENT][NOTIFY_COMPLETE_ROUTE_FAIL]", e);

    return NextResponse.json(
      {
        ok: false,
        error: "NOTIFY_COMPLETE_FAILED",
      },
      { status: 500 }
    );
  }
}
