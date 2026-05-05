
import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { submitPiPaymentFromRequest } from "@/lib/payments/payment.submit.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          requestId,
        },
        { status: 401 }
      );
    }

    const raw = await req.json().catch(() => null);

    const result = await submitPiPaymentFromRequest({
      userId: auth.userId,
      raw,
      requestId,
    });

    return NextResponse.json(result);
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
