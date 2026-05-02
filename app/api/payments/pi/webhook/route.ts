import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PiWebhookBody = {
  paymentId?: string;
  payment_id?: string;
  pi_payment_id?: string;
};

function extractPiPaymentId(raw: any): string | null {
  const id =
    typeof raw?.paymentId === "string"
      ? raw.paymentId
      : typeof raw?.payment_id === "string"
      ? raw.payment_id
      : typeof raw?.pi_payment_id === "string"
      ? raw.pi_payment_id
      : null;

  return id?.trim() || null;
}

export async function POST(req: Request) {
  console.log("[PI WEBHOOK] START");

  try {
    const raw = await req.json().catch(() => null);

    console.log("[PI WEBHOOK] BODY", raw);

    const piPaymentId = extractPiPaymentId(raw);

    if (!piPaymentId) {
      console.warn("[PI WEBHOOK] NO_PAYMENT_ID");
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    /* =====================================================
       STEP 1: FETCH REAL PAYMENT FROM PI API
    ===================================================== */

    const PI_API = process.env.PI_API_URL!;
    const PI_KEY = process.env.PI_API_KEY!;

    const piRes = await fetch(`${PI_API}/payments/${piPaymentId}`, {
      method: "GET",
      headers: {
        Authorization: `Key ${PI_KEY}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!piRes.ok) {
      const txt = await piRes.text();
      console.warn("[PI WEBHOOK] PI_FETCH_FAIL", txt);

      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const piPayment = await piRes.json();

    console.log("[PI WEBHOOK] PI_PAYMENT", piPayment);

    const paymentIntentId =
      piPayment?.metadata?.payment_intent_id ||
      null;

    const txid =
      piPayment?.transaction?.txid ||
      null;

    if (!paymentIntentId || !txid) {
      console.warn("[PI WEBHOOK] INCOMPLETE_PAYMENT_DATA");
      return NextResponse.json({ ok: true });
    }

    /* =====================================================
       STEP 2: CALL INTERNAL RECONCILE ENGINE
    ===================================================== */

    try {
      console.log("[PI WEBHOOK] TRIGGER_RECONCILE");

      const { POST: reconcile } = await import(
        "@/app/api/payments/pi/reconcile/route"
      );

      const fakeReq = new Request("http://internal/reconcile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer WEBHOOK_INTERNAL",
        },
        body: JSON.stringify({
          payment_intent_id: paymentIntentId,
          pi_payment_id: piPaymentId,
          txid,
          internal_webhook: true,
        }),
      });

      await reconcile(fakeReq as any);

      console.log("[PI WEBHOOK] RECONCILE_DONE");
    } catch (err) {
      console.error("[PI WEBHOOK] RECONCILE_FAIL", err);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error("[PI WEBHOOK] CRASH", err);

    return NextResponse.json(
      { error: "WEBHOOK_FAILED" },
      { status: 500 }
    );
  }
}
