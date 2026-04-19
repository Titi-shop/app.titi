import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getWalletByUserId } from "@/lib/db/wallet";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const wallet = await getWalletByUserId(auth.userId);
    return NextResponse.json(wallet);
  } catch (err) {
    console.error("[WALLET][GET_ERROR]", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
