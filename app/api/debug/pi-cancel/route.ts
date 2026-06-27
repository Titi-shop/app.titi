import { NextResponse } from "next/server";

import {
  cancelA2UPayment,
} from "@/lib/pi/pi.a2u";

export const runtime =
  "nodejs";

export async function GET() {
  try {
    const paymentId =
      "DwT5s1yCGN6FgW8wEJx9pVTYy2Rs";

    await cancelA2UPayment(
      paymentId
    );

    return NextResponse.json({
      success: true,
      paymentId,
    });

  } catch (error) {
    console.error(
      "[DEBUG_PI_CANCEL]",
      error
    );

    return NextResponse.json(
      {
        error:
          String(error),
      },
      {
        status: 500,
      }
    );
  }
}
