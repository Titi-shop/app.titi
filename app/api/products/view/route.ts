import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface ViewBody {
  id: string;
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("id" in body) ||
      typeof (body as ViewBody).id !== "string"
    ) {
      return NextResponse.json(
        { success: false, message: "Thiếu hoặc sai id" },
        { status: 400 }
      );
    }

    const { id } = body as ViewBody;
    // 🔥 validate uuid đơn giản
if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
  return NextResponse.json(
    { success: false, message: "INVALID_ID" },
    { status: 400 }
  );
}

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/increment_product_view`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pid: id }),
      }
    );


    // 🔥 anti spam (per request)
const ip =
  req.headers.get("x-forwarded-for") ||
  req.headers.get("x-real-ip") ||
  "unknown";

console.log("VIEW FROM:", ip);
    if (!res.ok) {
      const text = await res.text();
      console.error("❌ VIEW RPC ERROR:", text);
      return NextResponse.json(
        { success: false },
        { status: 500 }
      );
    }

    const data: { views: number }[] = await res.json();

    return NextResponse.json({
      success: true,
      views: data[0]?.views ?? 0,
    });
  } catch (err) {
    console.error("❌ VIEW ERROR:", err);
    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
