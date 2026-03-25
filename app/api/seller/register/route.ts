import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { resolveRole } from "@/lib/auth/resolveRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json(
        { error: "SERVER_MISCONFIGURED" },
        { status: 500 }
      );
    }

    /* 1️⃣ AUTH (Bearer only) */
    const user = await getUserFromBearer();
    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    /* 2️⃣ RBAC CHECK */
    const role = await resolveRole(user);

    const { rows } = await query(
  `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
  [user.pi_uid]
);

if (!rows.length) {
  return NextResponse.json(
    { error: "USER_NOT_FOUND" },
    { status: 404 }
  );
}

const userId = rows[0].id;
    if (role === "seller" || role === "admin") {
      return NextResponse.json({
        success: true,
        role,
        message: "ALREADY_SELLER",
      });
    }

    /* 3️⃣ CHECK PENDING REQUEST */
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/seller_requests?user_id=eq.${userId}&status=eq.pending&select=id`,
      {
        method: "GET",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      }
    );

    if (!checkRes.ok) {
      return NextResponse.json(
        { error: "CHECK_FAILED" },
        { status: 500 }
      );
    }

    const existing: unknown = await checkRes.json();

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json(
        { error: "REQUEST_ALREADY_PENDING" },
        { status: 409 }
      );
    }

    /* 4️⃣ AUTO-GENERATE SHOP NAME (SAFE) */
    const generatedShopName =
      typeof user.username === "string" && user.username.trim() !== ""
        ? `${user.username}'s Shop`
        : `Shop-${user.pi_uid.slice(0, 6)}`;

    /* 5️⃣ INSERT REQUEST */
    const insertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/seller_requests`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_id: userId,
          username: user.username ?? generatedShopName,
          shop_name: generatedShopName,
          shop_description: null,
          phone: null,
          email: null,
          status: "pending",
        }),
      }
    );

    if (!insertRes.ok) {
      const text = await insertRes.text();
      console.error("INSERT ERROR:", text);

      return NextResponse.json(
        { error: "INSERT_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      status: "pending",
    });
  } catch (err) {
    console.error("SELLER REGISTER FATAL:", err);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
