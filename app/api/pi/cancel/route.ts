import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* ================= TYPES ================= */

type Body = {
  paymentId?: unknown;
};

/* ================= API ================= */

export async function POST(req: Request) {
  try {
    console.log("🟡 [PI][CANCEL] START");

    /* ================= AUTH ================= */

    const auth = await getUserFromBearer();

    if (!auth) {
      console.error("❌ [PI][CANCEL] UNAUTHORIZED");
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    console.log("🟢 [PI][CANCEL] AUTH_OK", { userId });

    /* ================= BODY ================= */

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      console.error("❌ [PI][CANCEL] INVALID_BODY", raw);
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const body = raw as Body;

    const paymentId =
      typeof body.paymentId === "string"
        ? body.paymentId.trim()
        : "";

    if (!paymentId) {
      console.error("❌ [PI][CANCEL] MISSING_PAYMENT_ID");
      return NextResponse.json(
        { error: "MISSING_PAYMENT_ID" },
        { status: 400 }
      );
    }

    console.log("🟡 [PI][CANCEL] PAYMENT_ID", paymentId);

    /* ================= CALL PI ================= */

    console.log("🟡 [PI][CANCEL] CALL_PI");

    const cancelRes = await fetch(
      `${PI_API}/payments/${paymentId}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_KEY}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const text = await cancelRes.text();

    console.log("🟡 [PI][CANCEL] PI_STATUS", cancelRes.status);

    /* ================= HANDLE ERROR ================= */

    if (!cancelRes.ok) {
      console.error("❌ [PI][CANCEL] PI_ERROR", {
        status: cancelRes.status,
        body: text,
      });

      // 👇 xử lý trường hợp đã cancel / không tồn tại
      if (
        text.includes("not found") ||
        text.includes("already") ||
        text.includes("completed")
      ) {
        console.log("🟡 [PI][CANCEL] ALREADY_HANDLED");

        return NextResponse.json({
          success: true,
          message: "ALREADY_HANDLED",
        });
      }

      return NextResponse.json(
        { error: "PI_CANCEL_FAILED" },
        { status: 400 }
      );
    }

    /* ================= SUCCESS ================= */

    console.log("🟢 [PI][CANCEL] SUCCESS");

    return NextResponse.json({
      success: true,
      message: "CANCELLED",
    });

  } catch (err) {
    console.error("🔥 [PI][CANCEL] CRASH", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
