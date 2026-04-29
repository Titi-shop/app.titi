import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { withTransaction } from "@/lib/db";
import {
  verifyPiUser,
  fetchPiPayment,
  assertPiPaymentReady,
} from "@/lib/db/payments.verify";
import { verifyRpcTransaction } from "@/lib/db/payments.rpc";
import { submitPiPayment } from "@/lib/db/payments.submit";

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
  txid?: unknown;
};

/* =========================
   HELPERS
========================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPiPaymentRetry(piPaymentId: string) {
  let lastErr: unknown = null;

  for (let i = 1; i <= 4; i++) {
    try {
      console.log(`🟡 [PI_SUBMIT] FETCH_PI_PAYMENT_ATTEMPT_${i}`, piPaymentId);

      const payment = await fetchPiPayment(piPaymentId);

      console.log(`🟢 [PI_SUBMIT] FETCH_PI_PAYMENT_OK_${i}`);
      return payment;
    } catch (err) {
      lastErr = err;
      console.warn(`🟡 [PI_SUBMIT] FETCH_PI_PAYMENT_RETRY_${i}`, err);
      await sleep(600);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("PI_PAYMENT_NOT_READY");
}

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

  console.log("🟡 [PI_SUBMIT] PI_APPROVE_STATUS", res.status);
  console.log("🟡 [PI_SUBMIT] PI_APPROVE_BODY", text);

  if (!res.ok) {
    throw new Error("PI_APPROVE_FAILED");
  }

  return true;
}

async function callPiComplete(piPaymentId: string, txid: string) {
  console.log("🟡 [PI_SUBMIT] CALL_PI_COMPLETE", { piPaymentId, txid });

  const res = await fetch(`${PI_API}/payments/${piPaymentId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Key ${PI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ txid }),
    cache: "no-store",
  });

  const raw = await res.text();

  console.log("🟡 [PI_SUBMIT] PI_COMPLETE_STATUS", res.status);
  console.log("🟡 [PI_SUBMIT] PI_COMPLETE_BODY", raw);

  if (!res.ok) {
    try {
      const parsed = JSON.parse(raw);

      const alreadyCompleted =
        parsed?.error === "already_completed" ||
        parsed?.error_message?.includes("already");

      if (alreadyCompleted) {
        console.warn("🟡 [PI_SUBMIT] PI_ALREADY_COMPLETED");
        return true;
      }
    } catch {}

    throw new Error("PI_COMPLETE_FAILED");
  }

  return true;
}

/* =========================
   API
========================= */

export async function POST(req: Request) {
  try {
    console.log("🟡 [PI_SUBMIT] START");

    /* ================= AUTH ================= */

    const auth = await getUserFromBearer();

    if (!auth) {
      console.error("❌ [PI_SUBMIT] UNAUTHORIZED");
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    console.log("🟢 [PI_SUBMIT] AUTH_OK", { userId });

    /* ================= BODY ================= */

    const raw = await req.json().catch(() => null);

    console.log("🟡 [PI_SUBMIT] RAW_BODY", raw);

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

    const txid =
      typeof body.txid === "string"
        ? body.txid.trim()
        : "";

    console.log("🟡 [PI_SUBMIT] BODY_PARSED", {
      paymentIntentId,
      piPaymentId,
      txid,
    });

    if (!isUUID(paymentIntentId)) {
      console.error("❌ [PI_SUBMIT] INVALID_PAYMENT_INTENT", paymentIntentId);
      return NextResponse.json({ error: "INVALID_PAYMENT_INTENT" }, { status: 400 });
    }

    console.log("🟢 [PI_SUBMIT] PAYMENT_INTENT_OK");

    if (!piPaymentId) {
      console.error("❌ [PI_SUBMIT] INVALID_PI_PAYMENT_ID");
      return NextResponse.json({ error: "INVALID_PI_PAYMENT_ID" }, { status: 400 });
    }

    console.log("🟢 [PI_SUBMIT] PI_PAYMENT_ID_OK");

    if (!txid) {
      console.error("❌ [PI_SUBMIT] INVALID_TXID");
      return NextResponse.json({ error: "INVALID_TXID" }, { status: 400 });
    }

    console.log("🟢 [PI_SUBMIT] TXID_OK");

    /* ================= VERIFY PI USER TOKEN ================= */

    console.log("🟡 [PI_SUBMIT] VERIFY_PI_USER_START");

    const piUid = await verifyPiUser(req.headers.get("authorization") || "");

    console.log("🟢 [PI_SUBMIT] PI_USER_OK", { piUid });

    /* ================= FETCH PI PAYMENT ================= */

    const payment = await fetchPiPaymentRetry(piPaymentId);

    console.log("🟢 [PI_SUBMIT] PI_PAYMENT_FETCHED", {
      amount: payment.amount,
      user_uid: payment.user_uid,
      txid: payment.transaction?.txid,
      developer_approved: payment.status?.developer_approved,
      developer_completed: payment.status?.developer_completed,
    });

    /* ================= MERCHANT APPROVE ================= */

    if (!payment.status?.developer_approved) {
      console.log("🟡 [PI_SUBMIT] NEED_PI_APPROVE");
      await callPiApprove(piPaymentId);
      console.log("🟢 [PI_SUBMIT] PI_APPROVED");
    } else {
      console.log("🟢 [PI_SUBMIT] PI_ALREADY_APPROVED");
    }

    /* ================= VERIFY PI READY ================= */

    console.log("🟡 [PI_SUBMIT] ASSERT_PI_READY_START");

    assertPiPaymentReady({
      payment,
      expectedPiUid: piUid,
      expectedTxid: txid,
    });

    console.log("🟢 [PI_SUBMIT] PI_PAYMENT_READY");

    /* ================= VERIFY RPC ================= */

    console.log("🟡 [PI_SUBMIT] VERIFY_RPC_START");

    const rpc = await verifyRpcTransaction(txid);

    if (!rpc.ok) {
      console.error("❌ [PI_SUBMIT] RPC_VERIFY_FAILED", rpc.reason);
      return NextResponse.json(
        { error: rpc.reason || "RPC_VERIFY_FAILED" },
        { status: 400 }
      );
    }

    console.log("🟢 [PI_SUBMIT] RPC_OK");

    /* ================= DB ORCHESTRATION ================= */

    console.log("🟡 [PI_SUBMIT] DB_SETTLEMENT_START");

    const result = await withTransaction(async (client) => {
      console.log("🟡 [PI_SUBMIT] DB_TX_BEGIN");

      const r = await submitPiPayment(client, {
        userId,
        paymentIntentId,
        piPaymentId,
        txid,
        piUid,
        verifiedAmount: Number(payment.amount),
        rpcPayload: rpc.raw ?? null,
        piPayload: payment,
      });

      console.log("🟢 [PI_SUBMIT] DB_TX_DONE", r);

      return r;
    });

    console.log("🟢 [PI_SUBMIT] DB_SETTLEMENT_OK", result);

    /* ================= PI COMPLETE ================= */

    if (!payment.status?.developer_completed) {
      console.log("🟡 [PI_SUBMIT] NEED_PI_COMPLETE");
      await callPiComplete(piPaymentId, txid);
      console.log("🟢 [PI_SUBMIT] PI_COMPLETED");
    } else {
      console.log("🟢 [PI_SUBMIT] PI_ALREADY_COMPLETED");
    }

    console.log("🟢 [PI_SUBMIT] SUCCESS");

    return NextResponse.json({
      success: true,
      order_id: result.orderId,
      payment_intent_id: paymentIntentId,
      pi_payment_id: piPaymentId,
      txid,
    });
  } catch (err) {
    console.error("🔥 [PI_SUBMIT] CRASH", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "SUBMIT_FAILED",
      },
      { status: 400 }
    );
  }
}
