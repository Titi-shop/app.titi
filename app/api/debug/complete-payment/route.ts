// app/api/debug/complete-payment/route.ts

import { NextResponse } from "next/server";
import {
  completeA2UPayment,
} from "@/lib/pi/pi.a2u";

export async function GET() {
  try {
    await completeA2UPayment(
      "J2w2f4oTHK6sDRLToJjmmelmmyeT",
      "2e2b822fd776450d2b9387a3c911bb01a9445ad5527efc5a37fc083fae470de9"
    );

    return NextResponse.json({
      success: true,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json(
      {
        success: false,
        error: String(e),
      },
      {
        status: 500,
      }
    );
  }
}
