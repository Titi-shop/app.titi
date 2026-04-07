import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

export async function GET() {
  try {
    console.log("🟡 [PI][LIST_PENDING] START");

    /* ================= AUTH ================= */

    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    /* ================= CALL PI ================= */

    const res = await fetch(`${PI_API}/payments/incomplete`, {
      headers: {
        Authorization: `Key ${PI_KEY}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("❌ [PI][LIST_PENDING] PI_ERROR");
      return NextResponse.json(
        { error: "PI_FETCH_FAILED" },
        { status: 400 }
      );
    }

    const data = await res.json();

    console.log("🟢 [PI][LIST_PENDING] SUCCESS");

    /* ================= MAP DATA ================= */

    const result = Array.isArray(data)
      ? data.map((p: any) => ({
          paymentId: p.identifier,
          status: p.status,
          amount: p.amount,
        }))
      : [];

    return NextResponse.json({
      success: true,
      payments: result,
    });

  } catch (err) {
    console.error("🔥 [PI][LIST_PENDING] CRASH", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
