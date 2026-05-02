import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import { verifyPiPaymentForReconcile } from "@/lib/db/payments.verify";
import { verifyRpcPaymentV3 } from "@/lib/db/payments.rpc";
import { finalizePaidOrderFromIntent } from "@/lib/db/orders.payment";

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

type RpcAuditResult = {
  ok: boolean;
  audited: boolean;
  amount: number | null;
  sender: string | null;
  receiver: string | null;
  ledger: number | null;
  confirmed: boolean;
  chainReference: string | null;
  stage: string;
  reason: string | null;
  payload: unknown;
};

/* =========================================================
   HELPERS
========================================================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

function parseBody(raw: unknown): ReconcileBody | null {
  if (!raw || typeof raw !== "object") return null;

  const r = raw as Record<string, unknown>;

  const paymentIntentId =
    typeof r.payment_intent_id === "string" ? r.payment_intent_id.trim() : "";

  const piPaymentId =
    typeof r.pi_payment_id === "string" ? r.pi_payment_id.trim() : "";

  const txid =
    typeof r.txid === "string" ? r.txid.trim() : "";

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
   PI COMPLETE
========================================================= */

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

async function callPiComplete(
  piPaymentId: string,
  txid: string
): Promise<boolean> {
  try {
    console.log("[RECONCILE][PI] COMPLETE_CALL", { piPaymentId, txid });

    const res = await fetch(
      `${PI_API}/payments/${piPaymentId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txid }),
        cache: "no-store",
      }
    );

    const text = await res.text();

    if (!res.ok) {
      console.warn("[RECONCILE][PI] COMPLETE_FAIL", {
        status: res.status,
        body: text,
      });

      if (text.includes("already_completed")) {
        return true;
      }

      return false;
    }

    console.log("[RECONCILE][PI] COMPLETE_OK");
    return true;
  } catch (err) {
    console.error("[RECONCILE][PI] COMPLETE_CRASH", err);
    return false;
  }
}

/* =========================================================
   MAIN
========================================================= */

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  console.log("[RECONCILE] START", { requestId });

  try {
    /* =====================================================
       AUTH
    ===================================================== */

    const auth = await getUserFromBearer();

    if (!auth) {
      console.warn("[RECONCILE] UNAUTHORIZED");
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
      console.warn("[RECONCILE] INVALID_BODY", raw);
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { payment_intent_id, pi_payment_id, txid } = body;

    console.log("[RECONCILE] BODY_OK", {
      payment_intent_id,
      pi_payment_id,
      txid,
    });

    /* =====================================================
       STEP 1 — PI VERIFY (SOURCE OF TRUTH)
    ===================================================== */

    console.log("[RECONCILE] STEP_1_PI_VERIFY");

    const piVerified = await verifyPiPaymentForReconcile({
      paymentIntentId: payment_intent_id,
      piPaymentId: pi_payment_id,
      userId,
      txid,
    });

    if (!piVerified.ok) {
      console.warn("[RECONCILE] PI_VERIFY_FAIL");

      return NextResponse.json(
        { error: "PI_NOT_VERIFIED" },
        { status: 400 }
      );
    }

    console.log("[RECONCILE] PI_VERIFY_OK", {
      amount: piVerified.verifiedAmount,
    });

    /* =====================================================
       STEP 2 — RPC AUDIT (NON BLOCKING)
    ===================================================== */

    console.log("[RECONCILE] STEP_2_RPC_VERIFY");

    let rpcVerified: RpcAuditResult;

    try {
      rpcVerified = await verifyRpcPaymentV3({
        paymentIntentId: payment_intent_id,
        txid,
      });

      console.log("[RECONCILE] RPC_VERIFY_DONE", {
        ok: rpcVerified.ok,
        stage: rpcVerified.stage,
        reason: rpcVerified.reason,
        amount: rpcVerified.amount,
      });
    } catch (err) {
      console.error("[RECONCILE] RPC_VERIFY_CRASH", err);

      rpcVerified = {
        ok: false,
        audited: false,
        amount: null,
        sender: null,
        receiver: null,
        ledger: null,
        confirmed: false,
        chainReference: null,
        stage: "RPC_UNREACHABLE",
        reason: "RPC_UNREACHABLE",
        payload: {},
      };
    }

    /* =====================================================
       STEP 3 — FINALIZE PI COMPLETE (HARD GATE)
    ===================================================== */

    console.log("[RECONCILE] STEP_3_PI_COMPLETE");

    const piCompleted = await callPiComplete(
      pi_payment_id,
      txid
    );

    if (!piCompleted) {
      console.error("[RECONCILE] PI_COMPLETE_FAIL");

      return NextResponse.json(
        { error: "PI_COMPLETE_FAILED" },
        { status: 500 }
      );
    }

    console.log("[RECONCILE] PI_COMPLETE_OK");

    /* =====================================================
       STEP 4 — FINALIZE ORDER
    ===================================================== */

    console.log("[RECONCILE] STEP_4_FINALIZE");

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

    console.log("[RECONCILE] FINALIZE_OK", {
      orderId: paid.orderId,
    });

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json({
      success: true,
      requestId,

      order_id: paid.orderId,
      amount: piVerified.verifiedAmount,

      rpc_ok: rpcVerified.ok,
      rpc_stage: rpcVerified.stage,

      pi_completed: piCompleted,
    });
  } catch (err) {
    console.error("[RECONCILE] CRASH", err);

    return NextResponse.json(
      { error: "RECONCILE_FAILED" },
      { status: 500 }
    );
  }
}
