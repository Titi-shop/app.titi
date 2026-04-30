import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import { verifyPiPaymentForReconcile } from "@/lib/db/payments.verify";
import { verifyRpcPaymentForReconcile } from "@/lib/db/payments.rpc";
import { finalizePaidOrderFromIntent } from "@/lib/db/orders.payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   CONFIG
========================================================= */

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* =========================================================
   TYPES
========================================================= */

type Body = {
  payment_intent_id?: string;
  pi_payment_id?: string;
  txid?: string;
};

/* =========================================================
   VALIDATION
========================================================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

function isString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/* =========================================================
   PI COMPLETE (SAFE + IDEMPOTENT)
========================================================= */

async function callPiComplete(piPaymentId: string, txid: string) {
  try {
    const res = await fetch(
      `${PI_API}/payments/${piPaymentId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txid }),
      }
    );

    const text = await res.text();

    if (!res.ok) {
      if (text.includes("already_completed")) return true;
      return false;
    }

    return true;
  } catch (err) {
    console.error("🔥 [PI_COMPLETE_FAIL]", err);
    return false;
  }
}

/* =========================================================
   MAIN
========================================================= */

export async function POST(req: Request) {
  console.log("🟡 [RECONCILE_V2] START");

  try {
    /* =========================================================
       AUTH (Bearer → userId UUID)
    ========================================================= */

    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    /* =========================================================
       BODY PARSE (SAFE)
    ========================================================= */

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const body = raw as Body;

    const paymentIntentId = body.payment_intent_id?.trim();
    const piPaymentId = body.pi_payment_id?.trim();
    const txid = body.txid?.trim();

    if (!isUUID(paymentIntentId)) {
      return NextResponse.json(
        { error: "INVALID_PAYMENT_INTENT" },
        { status: 400 }
      );
    }

    if (!isString(piPaymentId) || !isString(txid)) {
      return NextResponse.json(
        { error: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    /* =========================================================
       STEP 1: PI VERIFY (SOURCE OF TRUTH)
    ========================================================= */

    console.log("🟡 [STEP_1_PI_VERIFY]");

    const piVerified = await verifyPiPaymentForReconcile({
      paymentIntentId,
      piPaymentId,
      userId,
      txid,
    });

    if (!piVerified?.ok) {
      return NextResponse.json(
        { error: "PI_NOT_VERIFIED" },
        { status: 400 }
      );
    }

    console.log("🟢 [PI_OK]", {
      amount: piVerified.verifiedAmount,
    });

    /* =========================================================
       STEP 2: RPC VERIFY (AUDIT ONLY - NON BLOCKING)
    ========================================================= */

    console.log("🟡 [STEP_2_RPC_VERIFY]");

    let rpcVerified: {
      ok?: boolean;
      skipped?: boolean;
      reason?: string;
      ledger?: number | null;
      status?: string;
    } = {};

    try {
      rpcVerified = await verifyRpcPaymentForReconcile({
        paymentIntentId,
        txid,
      });

      console.log("🟢 [RPC_OK]");
    } catch (err) {
      console.warn("⚠️ [RPC_FAIL_IGNORE]", {
        paymentIntentId,
        txid,
        message: err instanceof Error ? err.message : String(err),
      });

      rpcVerified = {
        skipped: true,
        reason: "RPC_FAILED",
      };
    }

    /* =========================================================
       STEP 3: FINALIZE ORDER (ATOMIC DB LAYER)
    ========================================================= */

    console.log("🟡 [STEP_3_FINALIZE]");

    const paid = await finalizePaidOrderFromIntent({
      paymentIntentId,
      piPaymentId,
      txid,
      verifiedAmount: piVerified.verifiedAmount,
      receiverWallet: piVerified.receiverWallet,
      piPayload: piVerified.piPayload,
      rpcPayload: rpcVerified,
      userId, // 👈 enforce auth-centric DB layer
    });

    console.log("🟢 [DB_OK]", {
      orderId: paid.orderId,
    });

    /* =========================================================
       STEP 4: PI COMPLETE (IDEMPOTENT)
    ========================================================= */

    console.log("🟡 [STEP_4_PI_COMPLETE]");

    await callPiComplete(piPaymentId, txid);

    console.log("🟢 [RECONCILE_V2_DONE]");

    /* =========================================================
       RESPONSE
    ========================================================= */

    return NextResponse.json({
      success: true,
      order_id: paid.orderId,
      amount: piVerified.verifiedAmount,
      rpc_verified: !rpcVerified?.skipped,
    });
  } catch (err) {
    console.error("🔥 [RECONCILE_CRASH]", err);

    return NextResponse.json(
      { error: "RECONCILE_FAILED" },
      { status: 500 }
    );
  }
}
