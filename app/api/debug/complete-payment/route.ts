// app/api/debug/complete-payment/route.ts

import { NextResponse } from "next/server";
import { completeA2UPayment } from "@/lib/pi/pi.a2u";

export async function POST() {
  await completeA2UPayment(
    "IOBhza8YXTZIcuyQWErZjbJUFJsY",
    "732729ccc696588e323d28bab2220ce26d3d24906f7050771c20d6c76d59127d"
  );

  return NextResponse.json({
    success: true,
  });
}
