import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  payment_intent_id?: unknown;
  pi_payment_id?: unknown;
};

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

export async function POST(req: Request) {
  try {
    console.log("🟡 [PI_SUBMIT] START");

    const auth = await getUserFromBearer();

    if (!auth) {
      console.error("❌ [PI_SUBMIT] UNAUTHORIZED");
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      console.error("❌ [PI_SUBMIT] INVALID_BODY");
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const body = raw as Body;

    const paymentIntentId =
      typeof body.payment_intent_id === "string"
        ? body.payment_intent_id.trim()
        : "";

    const piPaymentId =
      typeof body.pi_payment_id === "string"
        ? body.pi_payment_id.trim()
        : "";

    if (!isUUID(paymentIntentId)) {
      console.error("❌ [PI_SUBMIT] INVALID_PAYMENT_INTENT", paymentIntentId);
      return NextResponse.json({ error: "INVALID_PAYMENT_INTENT" }, { status: 400 });
    }

    if (!piPaymentId) {
      console.error("❌ [PI_SUBMIT] INVALID_PI_PAYMENT_ID");
      return NextResponse.json({ error: "INVALID_PI_PAYMENT_ID" }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const found = await client.query<{
        id: string;
        buyer_id: string;
        status: string;
        pi_payment_id: string | null;
      }>(
        `
        SELECT id,buyer_id,status,pi_payment_id
        FROM payment_intents
        WHERE id = $1
        FOR UPDATE
        `,
        [paymentIntentId]
      );

      if (!found.rows.length) {
        throw new Error("INTENT_NOT_FOUND");
      }

      const intent = found.rows[0];

      if (intent.buyer_id !== userId) {
        throw new Error("FORBIDDEN");
      }

      if (intent.status === "submitted" || intent.status === "verifying" || intent.status === "paid") {
        return {
          ok: true,
          already: true,
        };
      }

      if (intent.status !== "created" && intent.status !== "wallet_opened") {
        throw new Error("INVALID_STATUS");
      }

      await client.query(
        `
        UPDATE payment_intents
        SET
          pi_payment_id = $2,
          status = 'submitted',
          updated_at = now()
        WHERE id = $1
        `,
        [paymentIntentId, piPaymentId]
      );

      console.log("🟢 [PI_SUBMIT] SUBMITTED", {
        paymentIntentId,
        piPaymentId,
      });

      return {
        ok: true,
        payment_intent_id: paymentIntentId,
        pi_payment_id: piPaymentId,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("🔥 [PI_SUBMIT] CRASH", err);

    return NextResponse.json(
      { error: (err as Error).message || "SUBMIT_FAILED" },
      { status: 400 }
    );
  }
}
