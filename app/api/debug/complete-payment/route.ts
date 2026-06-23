// app/api/debug/complete-payment/route.ts

import { NextResponse } from "next/server";
import {
  completeA2UPayment,
} from "@/lib/pi/pi.a2u";

export async function GET() {
  try {
    await completeA2UPayment(
      "OhPh7jO3kQSY2mOvU7IaEgXrjfnj",
      "f503fa5d08db9502e20314cc095320ed9c4694b539be3b4c8028200e673b26a0"
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
