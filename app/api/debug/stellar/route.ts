import * as StellarSdk
  from "@stellar/stellar-sdk";

import { NextResponse }
  from "next/server";

export async function GET() {

  console.log(
    "[STELLAR_KEYS]",
    Object.keys(
      StellarSdk
    )
  );

  return NextResponse.json({
    ok: true,
  });
}
