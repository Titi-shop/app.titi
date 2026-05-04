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

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* =========================
   TYPES
========================= */

type AuthorizeBody = {
  payment_intent_id?: string;
  paymentIntentId?: string;
  pi_payment_id?: string;
  piPaymentId?: string;
};

/* =========================
   VALIDATE UUID (light)
========================= */

function isUUID(v: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

/* =========================
   PI APPROVE
========================= */

async function callPiApprove(piPaymentId: string): Promise<void> {
  const res = await fetch(`${PI_API}/payments/${piPaymentId}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Key ${PI_KEY}`,
    },
    cache: "no-store",
  });

  const data: unknown = await res.json().catch(() => null);

  const ok =
    res.ok ||
    (typeof data === "object" &&
      data !== null &&
      "error" in data &&
      (data as { error?: string }).error === "already_approved");

  if (!ok) {
    throw new Error("PI_APPROVE_FAILED");
  }
}

/* =========================
   ROUTE
========================= */

export async function POST(req: Request) {
  try {
    /* =========================
       AUTH
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
       BODY SAFE PARSE
    ========================= */

    let body: AuthorizeBody;

    try {
      body = (await req.json()) as AuthorizeBody;
    } catch {
      body = {};
    }

    console.log("🟡 [AUTHORIZE] BODY", body);

    const paymentIntentId =
      body.paymentIntentId ?? body.payment_intent_id;

    const piPaymentId =
      body.piPaymentId ?? body.pi_payment_id;

    /* =========================
       VALIDATION
    ========================= */

    if (!paymentIntentId || !piPaymentId) {
      console.log("❌ INVALID INPUT", body);

      return NextResponse.json(
        {
          error: "INVALID_INPUT",
        },
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
       PI VERIFY
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
       BIND DB
    ========================= */

    await withTransaction(async (client) => {
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
       APPROVE PI IF NEEDED
    ========================= */

    if (!payment.status?.developer_approved) {
      await callPiApprove(piPaymentId);
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "AUTHORIZE_FAILED";

    console.error("🔥 [AUTHORIZE ERROR]", e);

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
