import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import { verifyPiPaymentForReconcile } from "@/lib/db/payments.verify";
import { verifyRpcPaymentForReconcile } from "@/lib/db/payments.rpc";
import { finalizePaidOrderFromIntent } from "@/lib/db/orders.payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

type ReconcileBody = {
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

function parseBody(raw: unknown): ReconcileBody | null {
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

async function callPiComplete(
  piPaymentId: string,
  txid: string
): Promise<boolean> {
  try {
    const res = await fetch(`${PI_API}/payments/${piPaymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      if (text.includes("already_completed")) {
        console.log("[PAYMENT][RECONCILE] PI_ALREADY_COMPLETED");
        return true;
      }

      console.warn("[PAYMENT][RECONCILE] PI_COMPLETE_HTTP_FAIL", {
        status: res.status,
        body: text,
      });

      return false;
    }

    console.log("[PAYMENT][RECONCILE] PI_COMPLETE_OK");
    return true;
  } catch (err) {
    console.error("[PAYMENT][RECONCILE] PI_COMPLETE_CRASH", err);
    return false;
  }
}

export async function POST(req: Request) {
  console.log("[PAYMENT][RECONCILE] START");

  try {
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

    /* =========================================================
       STEP 1 — PI VERIFY
    ========================================================= */

    console.log("[PAYMENT][RECONCILE] STEP1_PI_VERIFY");

    const piVerified = await verifyPiPaymentForReconcile({
      paymentIntentId: payment_intent_id,
      piPaymentId: pi_payment_id,
      userId,
      txid,
    });

    if (!piVerified.ok) {
      console.warn("[PAYMENT][RECONCILE] PI_VERIFY_FAIL");

      return NextResponse.json(
        { error: "PI_NOT_VERIFIED" },
        { status: 400 }
      );
    }

    console.log("[PAYMENT][RECONCILE] PI_VERIFY_OK", {
      amount: piVerified.verifiedAmount,
    });

    /* =========================================================
       STEP 2 — RPC VERIFY (BLOCKING GATE)
    ========================================================= */

    console.log("[PAYMENT][RECONCILE] STEP2_RPC_VERIFY");

    const rpcVerified = await verifyRpcPaymentForReconcile({
      paymentIntentId: payment_intent_id,
      txid,
    });

    if (!rpcVerified.ok) {
      console.warn("[PAYMENT][RECONCILE] RPC_VERIFY_FAIL", {
        reason: rpcVerified.reason,
      });

      return NextResponse.json(
        {
          error: rpcVerified.reason || "RPC_NOT_VERIFIED",
        },
        { status: 400 }
      );
    }

    console.log("[PAYMENT][RECONCILE] RPC_VERIFY_OK", {
      amount: rpcVerified.amount,
      ledger: rpcVerified.ledger,
    });

    /* =========================================================
       STEP 3 — FINALIZE ORDER + PAYMENT RECEIPT (ATOMIC)
    ========================================================= */

    console.log("[PAYMENT][RECONCILE] STEP3_FINALIZE");

    const paid = await finalizePaidOrderFromIntent({
      paymentIntentId: payment_intent_id,
      piPaymentId: pi_payment_id,
      txid,
      verifiedAmount: piVerified.verifiedAmount,
      receiverWallet: piVerified.receiverWallet,
      piPayload: piVerified.piPayload,
      rpcPayload: rpcVerified,
      userId,
    });

    console.log("[PAYMENT][RECONCILE] FINALIZE_OK", {
      orderId: paid.orderId,
    });

    /* =========================================================
       STEP 4 — PI COMPLETE
    ========================================================= */

    console.log("[PAYMENT][RECONCILE] STEP4_PI_COMPLETE");

    const piCompleted = await callPiComplete(pi_payment_id, txid);

    console.log("[PAYMENT][RECONCILE] DONE", {
      piCompleted,
    });

    return NextResponse.json({
      success: true,
      order_id: paid.orderId,
      amount: piVerified.verifiedAmount,
      rpc_audited: rpcVerified.audited,
      pi_completed: piCompleted,
    });
  } catch (err) {
    console.error("[PAYMENT][RECONCILE] CRASH", err);

    return NextResponse.json(
      { error: "RECONCILE_FAILED" },
      { status: 500 }
    );
  }
}
