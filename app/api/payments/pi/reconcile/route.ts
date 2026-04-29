import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import { verifyPiPaymentForReconcile } from "@/lib/db/payments.verify";
import { verifyRpcPaymentForReconcile } from "@/lib/db/payments.rpc";
import { finalizePaidOrderFromIntent } from "@/lib/db/orders.payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function valid(v: unknown): v is string {
  return typeof v === "string" && v.length > 8;
}

async function completePiPayment(piPaymentId: string) {
  const key = process.env.PI_SERVER_API_KEY?.trim();

  if (!key) throw new Error("MISSING_PI_SERVER_API_KEY");

  const res = await fetch(
    `https://api.minepi.com/v2/payments/${piPaymentId}/complete`,
    {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  const data = await res.json().catch(() => null);

  console.log("🟡 [PI COMPLETE] RESPONSE", data);

  if (!res.ok) {
    throw new Error("PI_COMPLETE_FAILED");
  }

  return data;
}

export async function POST(req: Request) {
  try {
    console.log("🟡 [RECONCILE] START");

    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);

    console.log("🟡 [RECONCILE] BODY", body);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const paymentIntentId = body.payment_intent_id;
    const piPaymentId = body.pi_payment_id;
    const txid = body.txid;

    if (!valid(paymentIntentId) || !valid(piPaymentId) || !valid(txid)) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    /* =====================================================
       1. PI VERIFY
    ===================================================== */

    const piVerified = await verifyPiPaymentForReconcile({
      paymentIntentId,
      piPaymentId,
    });

    /* =====================================================
       2. RPC VERIFY
    ===================================================== */

    const rpcVerified = await verifyRpcPaymentForReconcile({
      paymentIntentId,
      txid,
    });

    /* =====================================================
       3. FINALIZE DB
    ===================================================== */

    const finalized = await finalizePaidOrderFromIntent({
      paymentIntentId,
      piPaymentId,
      txid,

      verifiedAmount: rpcVerified.amount,
      receiverWallet: rpcVerified.receiverWallet,

      piPayload: piVerified.raw,
      rpcPayload: rpcVerified.raw,
    });

    /* =====================================================
       4. COMPLETE PI SERVER
    ===================================================== */

    await completePiPayment(piPaymentId);

    console.log("🟢 [RECONCILE] SUCCESS", finalized);

    return NextResponse.json({
      ok: true,
      orderId: finalized.orderId,
      already: finalized.already || false,
    });
  } catch (err) {
    console.error("🔥 [RECONCILE] CRASH", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "RECONCILE_FAILED",
      },
      { status: 400 }
    );
  }
}
