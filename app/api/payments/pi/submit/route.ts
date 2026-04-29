import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["hkg1", "sin1"];

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* =========================
   TYPES
========================= */

type Body = {
  payment_intent_id?: unknown;
  pi_payment_id?: unknown;
};

/* =========================
   VALIDATION
========================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

/* =========================
   PI APPROVE (SAFE + IDEMPOTENT)
========================= */

async function callPiApprove(piPaymentId: string) {
  console.log("🟡 [PI_SUBMIT] CALL_PI_APPROVE", piPaymentId);

  const res = await fetch(`${PI_API}/payments/${piPaymentId}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Key ${PI_KEY}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();

  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {}

  console.log("🟡 [PI_SUBMIT] PI_APPROVE_STATUS", res.status);
  console.log("🟡 [PI_SUBMIT] PI_APPROVE_BODY", data || text);

  // ✅ HANDLE IDEMPOTENT CASE
  if (!res.ok) {
    if (data?.error === "already_approved") {
      console.log("🟢 [PI_SUBMIT] ALREADY_APPROVED_SAFE");
      return true;
    }

    throw new Error(data?.error || "PI_APPROVE_FAILED");
  }

  return true;
}

/* =========================
   MAIN API
========================= */

export async function POST(req: Request) {
  try {
    console.log("🟡 [PI_SUBMIT] START");

    const auth = await getUserFromBearer();

    if (!auth) {
      console.error("❌ [PI_SUBMIT] UNAUTHORIZED");
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    console.log("🟢 [PI_SUBMIT] AUTH_OK", { userId });

    const raw = await req.json().catch(() => null);

    console.log("🟡 [PI_SUBMIT] RAW_BODY", raw);

    if (!raw || typeof raw !== "object") {
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

    /* =========================
       DB TRANSACTION
    ========================= */

    const result = await withTransaction(async (client) => {
      console.log("🟡 [PI_SUBMIT] TX_BEGIN");

      const found = await client.query<{
        id: string;
        buyer_id: string;
        status: string;
        pi_payment_id: string | null;
      }>(
        `
        SELECT id, buyer_id, status, pi_payment_id
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

      console.log("🟢 [PI_SUBMIT] INTENT_FOUND", intent);

      if (intent.buyer_id !== userId) {
        throw new Error("FORBIDDEN");
      }

      /* =========================
         IDEMPOTENCY CHECK
      ========================= */

      if (intent.status === "paid") {
        console.log("🟢 [PI_SUBMIT] ALREADY_PAID");
        return {
          ok: true,
          already: true,
          payment_intent_id: paymentIntentId,
          pi_payment_id: intent.pi_payment_id ?? piPaymentId,
        };
      }

      if (intent.status === "submitted" || intent.status === "verifying") {
        console.log("🟢 [PI_SUBMIT] ALREADY_IN_PROGRESS");
        return {
          ok: true,
          already: true,
          payment_intent_id: paymentIntentId,
          pi_payment_id: intent.pi_payment_id ?? piPaymentId,
        };
      }

      /* =========================
         STATUS GUARD
      ========================= */

      const ALLOW = ["created", "wallet_opened"];

      if (!ALLOW.includes(intent.status)) {
        console.error("❌ [PI_SUBMIT] INVALID_STATUS", intent.status);
        throw new Error("INVALID_STATUS");
      }

      /* =========================
         APPROVE PI (SAFE)
      ========================= */

      await callPiApprove(piPaymentId);

      /* =========================
         UPDATE INTENT -> VERIFYING
      ========================= */

      await client.query(
        `
        UPDATE payment_intents
        SET
          pi_payment_id = $2,
          status = 'verifying',
          updated_at = now()
        WHERE id = $1
        `,
        [paymentIntentId, piPaymentId]
      );

      console.log("🟢 [PI_SUBMIT] STATUS_SET_VERIFYING");

      return {
        ok: true,
        payment_intent_id: paymentIntentId,
        pi_payment_id: piPaymentId,
      };
    });

    console.log("🟢 [PI_SUBMIT] SUCCESS", result);

    return NextResponse.json(result);
  } catch (err) {
    console.error("🔥 [PI_SUBMIT] CRASH", err);

    return NextResponse.json(
      { error: (err as Error).message || "SUBMIT_FAILED" },
      { status: 400 }
    );
  }
}
