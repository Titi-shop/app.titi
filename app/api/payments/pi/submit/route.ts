import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { markPaymentVerifying } from "@/lib/db/payments.submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmitBody = {
  payment_intent_id: string;
  pi_payment_id: string;
  txid: string;
};

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

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

  if (!isUUID(paymentIntentId) || !piPaymentId || !txid) {
    return null;
  }

  return {
    payment_intent_id: paymentIntentId,
    pi_payment_id: piPaymentId,
    txid,
  };
}

function getBaseUrl(req: Request): string {
  const host = req.headers.get("host");
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host?.includes("localhost") ? "http" : "https");

  if (!host) {
    throw new Error("HOST_NOT_FOUND");
  }

  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  try {
    console.log("[PAYMENT][SUBMIT] START");

    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    const raw = await req.json().catch(() => null);
    const body = parseBody(raw);

    if (!body) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const { payment_intent_id, pi_payment_id, txid } = body;

    console.log("[PAYMENT][SUBMIT] LOCK_VERIFYING");

    await markPaymentVerifying({
      paymentIntentId: payment_intent_id,
      userId,
      piPaymentId: pi_payment_id,
      txid,
    });

    const baseUrl = getBaseUrl(req);

    console.log("[PAYMENT][SUBMIT] CALL_RECONCILE_HTTP", {
      baseUrl,
    });

    const reconcileRes = await fetch(`${baseUrl}/api/payments/pi/reconcile`, {
      method: "POST",
      headers: {
        Authorization: req.headers.get("authorization") || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payment_intent_id,
        pi_payment_id,
        txid,
      }),
      cache: "no-store",
    });

    const reconcileData = await reconcileRes.json().catch(() => null);

    console.log("[PAYMENT][SUBMIT] RECONCILE_RESULT", {
      status: reconcileRes.status,
      reconcileData,
    });

    if (!reconcileRes.ok) {
      return NextResponse.json(
        {
          error:
            isRecord(reconcileData) && typeof reconcileData.error === "string"
              ? reconcileData.error
              : "RECONCILE_FAILED",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ...(isRecord(reconcileData) ? reconcileData : {}),
    });
  } catch (err) {
    console.error("[PAYMENT][SUBMIT] FAIL", err);

    return NextResponse.json({ error: "SUBMIT_FAILED" }, { status: 400 });
  }
}
