import { NextResponse }
  from "next/server";

import * as StellarSdk
  from "@stellar/stellar-sdk";

export const runtime =
  "nodejs";

export async function GET() {

  console.log(
    "[HORIZON]",
    typeof StellarSdk.Horizon
  );

  console.log(
    "[HORIZON_SERVER]",
    typeof StellarSdk.Horizon
      ?.Server
  );

  return NextResponse.json({
    horizon:
      typeof StellarSdk.Horizon,
    server:
      typeof StellarSdk.Horizon
        ?.Server,
  });
}
