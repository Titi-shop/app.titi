import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { withTransaction } from "@/lib/db";

import {
  verifyPiUser,
  fetchPiPayment,
  bindPiPaymentToIntent,
} from "@/lib/db/payments.verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   STRICT VALIDATION
========================================================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

function assertString(v: unknown, name: string): string {
  if (typeof v !== "string" || !v.trim()) {
    throw new Error(`INVALID_${name}`);
  }
  return v;
}

/* =========================================================
   PI APPROVE
========================================================= */

async function callPiApprove(piPaymentId: string) {
  const res = await fetch(
    `${process.env.PI_API_URL}/payments/${piPaymentId}/approve`,
    {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.PI_API_KEY}`,
      },
      cache: "no-store",
    }
  );

  const data = await res.json().catch(() => null);

  if (!res.ok && data?.error !== "already_approved") {
    throw new Error("PI_APPROVE_FAILED");
  }

  return true;
}

/* =========================================================
   MAIN
========================================================= */

export async function POST(req: Request) {
  try {
    /* =====================================================
       1. AUTH
    ===================================================== */

    const auth = await getUserFromBearer();
    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    /* =====================================================
       2. SAFE BODY PARSE
    ===================================================== */

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const paymentIntentId = assertString(
      body.payment_intent_id,
      "PAYMENT_INTENT_ID"
    );

    const piPaymentId = assertString(
      body.pi_payment_id,
      "PI_PAYMENT_ID"
    );

    if (!isUUID(paymentIntentId)) {
      return NextResponse.json(
        { error: "INVALID_PAYMENT_INTENT_ID" },
        { status: 400 }
      );
    }

    /* =====================================================
       3. VERIFY PI USER
    ===================================================== */

    const piUid = await verifyPiUser(
      req.headers.get("authorization") || ""
    );

    /* =====================================================
       4. FETCH PI PAYMENT
    ===================================================== */

    const payment = await fetchPiPayment(piPaymentId);

    if (!payment?.identifier) {
      throw new Error("PI_PAYMENT_NOT_FOUND");
    }

    if (payment.user_uid !== piUid) {
      return NextResponse.json(
        { error: "PI_USER_MISMATCH" },
        { status: 400 }
      );
    }

    if (!payment.status?.developer_approved) {
      return NextResponse.json(
        { error: "PI_NOT_APPROVED_YET" },
        { status: 400 }
      );
    }

    /* =====================================================
       5. BIND IN TRANSACTION (HARDENED)
    ===================================================== */

    await withTransaction(async (client) => {
      await bindPiPaymentToIntent(client, {
        userId,
        paymentIntentId,
        piPaymentId,
        piUid,
        verifiedAmount: Number(payment.amount),
        piPayload: payment,
      });
    });

    /* =====================================================
       6. APPROVE (SAFE IDEMPOTENT)
    ===================================================== */

    try {
      await callPiApprove(piPaymentId);
    } catch (e) {
      console.warn("[PI_APPROVE_WARN]", e);
    }

    /* =====================================================
       7. SUCCESS
    ===================================================== */

    return NextResponse.json({
      success: true,
      paymentIntentId,
      piPaymentId,
    });
  } catch (e) {
    console.error("[PI AUTHORIZE FAIL]", e);

    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "AUTHORIZE_FAILED",
      },
      { status: 400 }
    );
  }
}
