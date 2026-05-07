import {
  NextRequest,
  NextResponse,
  waitUntil,
} from "next/server";

import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import { markPaymentVerifying } from "@/lib/db/payments.submit";

import { runPaymentSettlement } from "@/lib/payments/payment.orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  console.log("[PAYMENT][NOTIFY_COMPLETE_INCOMING]", {
    requestId,
  });

  try {
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

    const raw = await req.json().catch(() => null);

    console.log("[PAYMENT][NOTIFY_COMPLETE_RAW]", {
      requestId,
      raw,
    });

    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_BODY",
          requestId,
        },
        { status: 400 }
      );
    }

    const paymentIntentId = asText(raw.payment_intent_id);

    const piPaymentId = asText(raw.pi_payment_id);

    const txid = asText(raw.txid);

    if (!paymentIntentId || !piPaymentId || !txid) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_FIELDS",
          requestId,
        },
        { status: 400 }
      );
    }

    console.log("[PAYMENT][NOTIFY_COMPLETE_START]", {
      requestId,
      userId: auth.userId,
      paymentIntentId,
      piPaymentId,
      txid,
    });

    await markPaymentVerifying({
      paymentIntentId,
      userId: auth.userId,
      piPaymentId,
      txid,
    });

    console.log("[PAYMENT][NOTIFY_COMPLETE_MARKED]", {
      requestId,
    });

    waitUntil(
      runPaymentSettlement({
        paymentIntentId,
        piPaymentId,
        txid,
        userId: auth.userId,
        source: "notify-complete",
      })
        .then((res) => {
          console.log("[PAYMENT][NOTIFY_COMPLETE_DONE]", {
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

    return NextResponse.json({
      ok: true,
      processing: true,
      requestId,
      payment_intent_id: paymentIntentId,
    });
  } catch (err) {
    console.error("[PAYMENT][NOTIFY_COMPLETE_FATAL]", {
      requestId,
      err,
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
