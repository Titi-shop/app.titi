import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { processPiPayment } from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* ================= SAFE ================= */

function safeQuantity(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n)) return 1;
  if (n < 1) return 1;
  if (n > 10) return 10;
  return n;
}

type Body = {
  paymentId?: unknown;
  txid?: unknown;
  product_id?: unknown;
  quantity?: unknown;
};

export async function POST(req: Request) {
  try {
    /* ================= BODY ================= */

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const body = raw as Body;

    const paymentId =
      typeof body.paymentId === "string" ? body.paymentId : "";

    const txid =
      typeof body.txid === "string" ? body.txid : "";

    const productId =
      typeof body.product_id === "string" ? body.product_id : "";

    const quantity = safeQuantity(body.quantity);

    if (!paymentId || !txid || !productId) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    /* ================= AUTH ================= */

    const authUser = await getUserFromBearer(req);

    if (!authUser) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const pi_uid = authUser.pi_uid;

    /* ================= VERIFY PI ================= */

    const piRes = await fetch(`${PI_API}/payments/${paymentId}`, {
      headers: { Authorization: `Key ${PI_KEY}` },
      cache: "no-store",
    });

    if (!piRes.ok) {
      return NextResponse.json(
        { error: "PI_PAYMENT_NOT_FOUND" },
        { status: 400 }
      );
    }

    const payment = await piRes.json();

    if (payment.user_uid !== pi_uid) {
      return NextResponse.json(
        { error: "INVALID_PAYMENT_OWNER" },
        { status: 403 }
      );
    }

    if (payment.status !== "approved") {
      return NextResponse.json(
        { error: "PAYMENT_NOT_APPROVED" },
        { status: 400 }
      );
    }

    /* ================= COMPLETE PI ================= */

    const completeRes = await fetch(
      `${PI_API}/payments/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txid }),
      }
    );

    const completeData = await completeRes.json().catch(() => null);

    if (!completeRes.ok) {
      if (
        completeData?.error?.includes?.("already") ||
        completeData?.message?.includes?.("completed")
      ) {
        // ok
      } else {
        return NextResponse.json(
          { error: "PI_COMPLETE_FAILED" },
          { status: 400 }
        );
      }
    }

    /* ================= DB PROCESS ================= */

    const result = await processPiPayment({
      piUid: pi_uid,
      productId,
      quantity,
      paymentId,
      txid,
    });

    return NextResponse.json({
      success: true,
      order_id: result.orderId,
    });

  } catch (err) {
    console.error("[PI_COMPLETE]", err);

    const message =
      err instanceof Error ? err.message : "SERVER_ERROR";

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
