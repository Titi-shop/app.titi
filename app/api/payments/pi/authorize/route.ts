import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { withTransaction } from "@/lib/db";
import {
  verifyPiUser,
  fetchPiPayment,
  bindPiPaymentToIntent,
} from "@/lib/db/payments.verify";
import { piApprovePayment } from "@/lib/pi/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  paymentIntentId?: string;
  payment_intent_id?: string;
  piPaymentId?: string;
  pi_payment_id?: string;
};

function isUUID(v: string) {
  return /^[0-9a-f-]{36}$/i.test(v);
}

export async function POST(req: Request) {
  try {
    /* =========================
       AUTH (NETWORK-FIRST)
    ========================= */
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    /* =========================
       PARSE BODY
    ========================= */
    const body: Body = await req.json().catch(() => ({}));

    const paymentIntentId =
      body.paymentIntentId ?? body.payment_intent_id;

    const piPaymentId =
      body.piPaymentId ?? body.pi_payment_id;

    if (!paymentIntentId || !piPaymentId) {
      return NextResponse.json(
        { error: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    if (!isUUID(paymentIntentId)) {
      return NextResponse.json(
        { error: "INVALID_PAYMENT_INTENT_ID" },
        { status: 400 }
      );
    }

    /* =========================
       PI VERIFY (AUTH LAYER ONLY)
    ========================= */
    const piUid = await verifyPiUser(
      req.headers.get("authorization") || ""
    );

    const payment = await fetchPiPayment(piPaymentId);

    if (payment.user_uid !== piUid) {
      return NextResponse.json(
        { error: "PI_USER_MISMATCH" },
        { status: 400 }
      );
    }

    /* =========================
       DB TRANSACTION (CORE SYSTEM)
    ========================= */
    await withTransaction(async () => {
      await bindPiPaymentToIntent({
        userId,
        paymentIntentId,
        piPaymentId,
        piUid,
        verifiedAmount: Number(payment.amount),
        piPayload: payment,
      });
    });

    /* =========================
       PI APPROVE (EXTERNAL SIDE EFFECT)
    ========================= */
    if (!payment.status?.developer_approved) {
      await piApprovePayment(piPaymentId);
    }

    /* =========================
       RESPONSE
    ========================= */
    return NextResponse.json({ success: true });
  } catch (e) {
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
