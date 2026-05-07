
import { NextResponse } from "next/server";

import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import { submitPiPaymentFromRequest } from "@/lib/payments/payment.submit.service";

import { runPaymentSettlementFromRequest } from "@/lib/payments/payment.orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  console.log("[PAYMENT][SUBMIT_ROUTE] START", {
    requestId,
  });

  try {
    /* =====================================================
       1. AUTH
    ===================================================== */

    const auth = await getUserFromBearer();

    if (!auth) {
      console.error("[PAYMENT][SUBMIT_ROUTE] AUTH_FAIL", {
        requestId,
      });

      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          requestId,
        },
        { status: 401 }
      );
    }

    /* =====================================================
       2. BODY
    ===================================================== */

    const raw = await req.json().catch(() => null);

    console.log("[PAYMENT][SUBMIT_ROUTE] BODY_OK", {
      requestId,
      raw,
    });

    /* =====================================================
       3. MARK VERIFYING
    ===================================================== */

    const submitResult = await submitPiPaymentFromRequest({
      userId: auth.userId,
      raw,
      requestId,
    });

    console.log("[PAYMENT][SUBMIT_ROUTE] VERIFYING_OK", {
      requestId,
      submitResult,
    });

    /* =====================================================
       4. FULL SETTLEMENT
    ===================================================== */

    console.log("[PAYMENT][SUBMIT_ROUTE] SETTLEMENT_START", {
      requestId,
    });

    const settlement = await runPaymentSettlementFromRequest({
      rawBody: raw,
      userId: auth.userId,
      source: "submit-api",
    });

    if (!settlement) {
      console.error("[PAYMENT][SUBMIT_ROUTE] SETTLEMENT_NULL", {
        requestId,
      });

      return NextResponse.json(
        {
          success: false,
          error: "SETTLEMENT_FAILED",
          requestId,
        },
        { status: 400 }
      );
    }

    console.log("[PAYMENT][SUBMIT_ROUTE] SETTLEMENT_DONE", {
      requestId,
      settlement,
    });

    /* =====================================================
       5. RESPONSE
    ===================================================== */

    return NextResponse.json({
      success: settlement.ok,
      requestId,

      order_id: settlement.orderId,

      amount: settlement.amount,

      pi_completed: settlement.piCompleted,

      rpc_audited: settlement.rpcAudited,

      source: settlement.source,
    });
  } catch (e: unknown) {
    console.error("[PAYMENT][SUBMIT_ROUTE_CRASH]", {
      requestId,
      error: e,
    });

    return NextResponse.json(
      {
        success: false,
        error:
          e instanceof Error
            ? e.message
            : "SUBMIT_FAILED",
        requestId,
      },
      { status: 400 }
    );
  }
}
