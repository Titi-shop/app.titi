import { NextResponse } from "next/server";

import {
  getA2UPayment,
} from "@/lib/pi/pi.a2u";

export const runtime = "nodejs";

export async function GET() {
  try {
    const payment =
  await getA2UPayment(
    "28HYPKjUwcu9DFluFepspdDxHNlg"
  );

    console.log(
      "[DEBUG_PI_PAYMENT]",
      JSON.stringify(
        payment,
        null,
        2
      )
    );

    return NextResponse.json(
      payment
    );
  } catch (error) {
    console.error(
      "[DEBUG_PI_PAYMENT]",
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
