import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { runPaymentSettlement } from "@/lib/payments/payment.orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type ReconcileBody = {
  payment_intent_id: string;
  pi_payment_id: string;
  txid: string;
};

/* =========================================================
   SAFE PARSE
========================================================= */

function parseBody(raw: unknown): ReconcileBody | null {
  if (!raw || typeof raw !== "object") return null;

  const r = raw as Record<string, unknown>;

  const paymentIntentId =
    typeof r.payment_intent_id === "string"
      ? r.payment_intent_id.trim()
      : "";

  const piPaymentId =
    typeof r.pi_payment_id === "string"
      ? r.pi_payment_id.trim()
      : "";

  const txid =
    typeof r.txid === "string"
      ? r.txid.trim()
      : "";

  if (!paymentIntentId || !piPaymentId || !txid) return null;

  return {
    payment_intent_id: paymentIntentId,
    pi_payment_id: piPaymentId,
    txid,
  };
}

/* =========================================================
   MAIN ROUTE (MỎNG - CLEAN ARCHITECTURE)
========================================================= */

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  console.log("[RECONCILE API] START", { requestId });

  try {
    /* =====================================================
       AUTH
    ===================================================== */

    const auth = await getUserFromBearer();

    if (!auth) {
      console.warn("[RECONCILE API] UNAUTHORIZED");

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

    const raw = await req.json().catch(() => null);
    const body = parseBody(raw);

    if (!body) {
      console.warn("[RECONCILE API] INVALID_BODY", raw);

      return NextResponse.json(
        {
          success: false,
          error: "INVALID_BODY",
          requestId,
        },
        { status: 400 }
      );
    }

    const { payment_intent_id, pi_payment_id, txid } = body;

    console.log("[RECONCILE API] BODY_OK", {
      payment_intent_id,
      pi_payment_id,
      txid,
    });

    /* =====================================================
       ORCHESTRATOR (CORE LOGIC)
    ===================================================== */

    const result = await runPaymentSettlement({
      paymentIntentId: payment_intent_id,
      piPaymentId: pi_payment_id,
      txid,
      userId,
      source: "reconcile-api",
    });

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json({
      success: result.ok,
      requestId,

      order_id: result.orderId,
      amount: result.amount,

      pi_completed: result.piCompleted,
      rpc_audited: result.rpcAudited,

      source: result.source,
    });
  } catch (err) {
    console.error("[RECONCILE API] CRASH", err);

    return NextResponse.json(
      {
        success: false,
        error: "RECONCILE_FAILED",
        requestId,
      },
      { status: 500 }
    );
  }
}
