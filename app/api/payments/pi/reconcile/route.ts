import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { runPaymentSettlementFromRequest } from "@/lib/payments/payment.orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", requestId },
        { status: 401 }
      );
    }

    const rawBody = await req.json().catch(() => null);

    const result = await runPaymentSettlementFromRequest({
      rawBody,
      userId: auth.userId,
      source: "reconcile-api",
    });

    return NextResponse.json({
      success: result.ok,
      requestId,
      order_id: result.orderId,
      amount: result.amount,
      pi_completed: result.piCompleted,
      rpc_audited: result.rpcAudited,
      source: result.source,
    });
  } catch (error) {
    console.error("[PAYMENT][RECONCILE_ROUTE_CRASH]", error);

    return NextResponse.json(
      { error: "RECONCILE_FAILED", requestId },
      { status: 500 }
    );
  }
}
