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
   SAFE UUID
========================================================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

/* =========================================================
   SAFE JSON PARSE GUARD
========================================================= */

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch (e) {
    return null;
  }
}

/* =========================================================
   MAIN
========================================================= */

export async function POST(req: Request) {
  try {
    console.log("🟡 [AUTHORIZE V3] START");

    /* ================= AUTH ================= */

    const auth = await getUserFromBearer();
    if (!auth) {
      console.log("❌ NO AUTH");
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    /* ================= BODY ================= */

    const body = await safeJson(req);

    console.log("🟡 [AUTHORIZE V3] BODY", body);

    const paymentIntentId = body?.payment_intent_id;
    const piPaymentId = body?.pi_payment_id;

    if (!isUUID(paymentIntentId) || typeof piPaymentId !== "string") {
      console.log("❌ INVALID INPUT", {
        paymentIntentId,
        piPaymentId,
      });

      return NextResponse.json(
        {
          error: "INVALID_INPUT",
          debug: { paymentIntentId, piPaymentId },
        },
        { status: 400 }
      );
    }

    /* ================= PI VERIFY ================= */

    const piUid = await verifyPiUser(
      req.headers.get("authorization") || ""
    );

    const payment = await fetchPiPayment(piPaymentId);

    console.log("🟡 [AUTHORIZE V3] PI PAYMENT", payment);

    if (payment.user_uid !== piUid) {
      return NextResponse.json(
        { error: "PI_USER_MISMATCH" },
        { status: 400 }
      );
    }

    /* ================= DB BIND ================= */

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

    console.log("🟢 [AUTHORIZE V3] SUCCESS");

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("🔥 [AUTHORIZE V3 ERROR]", e);

    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "AUTHORIZE_FAILED",
      },
      { status: 400 }
    );
  }
}
