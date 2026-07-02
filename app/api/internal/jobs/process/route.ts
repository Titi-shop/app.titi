import { NextResponse } from "next/server";

import {
  processEscrowReleaseJob,
} from "@/lib/services/escrow.release.job";
import {
  processPaymentIntentExpireJob,
} from "@/lib/services/payment.intent.expire.job";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const escrowResult =
      await processEscrowReleaseJob();

    const paymentIntentResult =
      await processPaymentIntentExpireJob();

    return NextResponse.json({
      success: true,
      escrow: escrowResult,
      paymentIntent: paymentIntentResult,
    });

  } catch (error) {

    console.error(
      "[JOBS][FATAL]",
      error
    );

    return NextResponse.json(
      {
        success: false,
      },
      {
        status: 500,
      }
    );
  }
}
