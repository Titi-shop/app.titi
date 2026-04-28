import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["hkg1", "sin1"];

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

type Body = {
  payment_intent_id?: unknown;
  pi_payment_id?: unknown;
  txid?: unknown;
};

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

/* replace later with real rpc */
async function verifyRpc(txid: string) {
  console.log("🟡 [PI_RECONCILE] VERIFY_RPC", txid);

  return {
    ok: true,
    raw: {},
  };
}

async function callPiComplete(piPaymentId: string, txid: string) {
  console.log("🟡 [PI_RECONCILE] CALL_PI_COMPLETE", piPaymentId);

  const res = await fetch(`${PI_API}/payments/${piPaymentId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Key ${PI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ txid }),
    cache: "no-store",
  });

  const text = await res.text();

  console.log("🟡 [PI_RECONCILE] PI_COMPLETE_STATUS", res.status);
  console.log("🟡 [PI_RECONCILE] PI_COMPLETE_BODY", text);

  if (!res.ok) {
    throw new Error("PI_COMPLETE_FAILED");
  }

  return true;
}

export async function POST(req: Request) {
  try {
    console.log("🟡 [PI_RECONCILE] START");

    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    const raw = await req.json().catch(() => null);

    console.log("🟡 [PI_RECONCILE] RAW_BODY", raw);

    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const body = raw as Body;

    const paymentIntentId =
      typeof body.payment_intent_id === "string" ? body.payment_intent_id.trim() : "";

    const piPaymentId =
      typeof body.pi_payment_id === "string" ? body.pi_payment_id.trim() : "";

    const txid =
      typeof body.txid === "string" ? body.txid.trim() : "";

    if (!isUUID(paymentIntentId)) {
      return NextResponse.json({ error: "INVALID_PAYMENT_INTENT" }, { status: 400 });
    }

    if (!piPaymentId) {
      return NextResponse.json({ error: "INVALID_PI_PAYMENT_ID" }, { status: 400 });
    }

    if (!txid) {
      return NextResponse.json({ error: "INVALID_TXID" }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const found = await client.query<any>(
        `
        SELECT *
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

      console.log("🟢 [PI_RECONCILE] INTENT_FOUND", intent);

      if (intent.buyer_id !== userId) {
        throw new Error("FORBIDDEN");
      }

      if (intent.status === "paid") {
        return {
          ok: true,
          already: true,
          order_id: intent.order_id ?? null,
        };
      }

      const rpc = await verifyRpc(txid);

      if (!rpc.ok) {
        throw new Error("RPC_VERIFY_FAILED");
      }

      await callPiComplete(piPaymentId, txid);

      const order = await client.query<{ id: string }>(
        `
        INSERT INTO orders (
          buyer_id,
          seller_id,
          total_amount,
          status
        )
        VALUES ($1,$2,$3,'paid')
        RETURNING id
        `,
        [
          intent.buyer_id,
          intent.seller_id,
          intent.total_amount
        ]
      );

      await client.query(
        `
        UPDATE payment_intents
        SET
          txid = $2,
          status = 'paid',
          paid_at = now(),
          updated_at = now()
        WHERE id = $1
        `,
        [paymentIntentId, txid]
      );

      console.log("🟢 [PI_RECONCILE] PAID_OK", {
        paymentIntentId,
        txid,
        orderId: order.rows[0].id,
      });

      return {
        ok: true,
        order_id: order.rows[0].id,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("🔥 [PI_RECONCILE] CRASH", err);

    return NextResponse.json(
      { error: (err as Error).message || "RECONCILE_FAILED" },
      { status: 400 }
    );
  }
}
