import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["hkg1", "sin1"];

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

function nowMs() {
  return Date.now();
}

export async function POST(req: Request) {
  const startedAt = nowMs();

  try {
    console.log("🟡 [PI_SUBMIT] START", {
      at: new Date().toISOString(),
    });

    /* ================= AUTH ================= */

    const authStart = nowMs();
    const auth = await getUserFromBearer();

    console.log("🟡 [PI_SUBMIT] AUTH_CHECK_MS", nowMs() - authStart);

    if (!auth) {
      console.error("❌ [PI_SUBMIT] UNAUTHORIZED");

      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    console.log("🟢 [PI_SUBMIT] AUTH_OK", { userId });

    /* ================= BODY ================= */

    const bodyStart = nowMs();
    const raw = await req.json().catch(() => null);

    console.log("🟡 [PI_SUBMIT] BODY_PARSE_MS", nowMs() - bodyStart);
    console.log("🟡 [PI_SUBMIT] RAW_BODY", raw);

    if (!raw || typeof raw !== "object") {
      console.error("❌ [PI_SUBMIT] INVALID_BODY");

      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
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

    console.log("🟡 [PI_SUBMIT] PARSED_IDS", {
      paymentIntentId,
      piPaymentId,
    });

    if (!isUUID(paymentIntentId)) {
      console.error("❌ [PI_SUBMIT] INVALID_PAYMENT_INTENT", paymentIntentId);

      return NextResponse.json(
        { error: "INVALID_PAYMENT_INTENT" },
        { status: 400 }
      );
    }

    if (!piPaymentId) {
      console.error("❌ [PI_SUBMIT] INVALID_PI_PAYMENT_ID");

      return NextResponse.json(
        { error: "INVALID_PI_PAYMENT_ID" },
        { status: 400 }
      );
    }

    /* ================= DB TX ================= */

    const txStart = nowMs();

    const result = await withTransaction(async (client) => {
      console.log("🟡 [PI_SUBMIT] TX_BEGIN");

      /* ===== LOCK INTENT ===== */

      const lockStart = nowMs();

      console.log("🟡 [PI_SUBMIT] LOCKING_INTENT", paymentIntentId);

      const found = await client.query<{
        id: string;
        buyer_id: string;
        status: string;
        pi_payment_id: string | null;
        total_amount: string;
        created_at: string;
      }>(
        `
        SELECT id,buyer_id,status,pi_payment_id,total_amount,created_at
        FROM payment_intents
        WHERE id = $1
        FOR UPDATE
        `,
        [paymentIntentId]
      );

      console.log("🟡 [PI_SUBMIT] LOCK_QUERY_MS", nowMs() - lockStart);

      if (!found.rows.length) {
        console.error("❌ [PI_SUBMIT] INTENT_NOT_FOUND");
        throw new Error("INTENT_NOT_FOUND");
      }

      const intent = found.rows[0];

      console.log("🟢 [PI_SUBMIT] INTENT_FOUND", intent);

      /* ===== OWNER CHECK ===== */

      if (intent.buyer_id !== userId) {
        console.error("❌ [PI_SUBMIT] FORBIDDEN_OWNER", {
          buyer_id: intent.buyer_id,
          userId,
        });

        throw new Error("FORBIDDEN");
      }

      /* ===== IDEMPOTENT CHECK ===== */

      if (
        intent.status === "submitted" ||
        intent.status === "verifying" ||
        intent.status === "paid"
      ) {
        console.log("🟢 [PI_SUBMIT] ALREADY_DONE", {
          status: intent.status,
        });

        return {
          ok: true,
          already: true,
          payment_intent_id: paymentIntentId,
          pi_payment_id: intent.pi_payment_id ?? piPaymentId,
        };
      }

      /* ===== STATUS CHECK ===== */

      if (intent.status !== "created" && intent.status !== "wallet_opened") {
        console.error("❌ [PI_SUBMIT] INVALID_STATUS", intent.status);
        throw new Error("INVALID_STATUS");
      }

      /* ===== UPDATE ===== */

      const updateStart = nowMs();

      console.log("🟡 [PI_SUBMIT] UPDATING_TO_SUBMITTED");

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

      console.log("🟡 [PI_SUBMIT] UPDATE_MS", nowMs() - updateStart);

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

    console.log("🟡 [PI_SUBMIT] TX_TOTAL_MS", nowMs() - txStart);
    console.log("🟢 [PI_SUBMIT] RESPONSE_OK", result);
    console.log("🟢 [PI_SUBMIT] TOTAL_MS", nowMs() - startedAt);

    return NextResponse.json(result);
  } catch (err) {
    console.error("🔥 [PI_SUBMIT] CRASH", err);
    console.error("🔥 [PI_SUBMIT] TOTAL_MS_BEFORE_CRASH", nowMs() - startedAt);

    return NextResponse.json(
      {
        error: (err as Error).message || "SUBMIT_FAILED",
      },
      { status: 400 }
    );
  }
}
