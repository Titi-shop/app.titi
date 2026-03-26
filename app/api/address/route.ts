import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { query } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =====================================================
   TYPES
===================================================== */
interface AddressInsert {
  full_name: string;
  phone: string;
  country: string;
  province: string;
  district?: string | null;
  ward?: string | null;
  address_line: string;
  postal_code?: string | null;
  label?: "home" | "office" | "other";
}

/* =====================================================
   GET – LIST
===================================================== */
export async function GET() {
  const user = await getUserFromBearer();
   const userRes = await query(
  `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
  [user.pi_uid]
);

if (userRes.rowCount === 0) {
  return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
}

const userId = userRes.rows[0].id;
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, items: data ?? [] });
}

/* =====================================================
   POST – CREATE
===================================================== */
export async function POST(req: Request) {
  const user = await getUserFromBearer();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const {
    full_name,
    phone,
    country,
    province,
    district,
    ward,
    address_line,
    postal_code,
    label,
  } = body as Partial<AddressInsert>;

  if (
    typeof full_name !== "string" ||
    typeof phone !== "string" ||
    typeof country !== "string" ||
    typeof province !== "string" ||
    typeof address_line !== "string"
  ) {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  /* Clear previous default (safe even if none exists) */
  const { error: clearError } = await supabaseAdmin
    .from("addresses")
    .update({ is_default: false })
    const userRes = await query(
  `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
  [user.pi_uid]
);

if (userRes.rowCount === 0) {
  return NextResponse.json({ success: true, items: [] });
}

const userId = userRes.rows[0].id;

  if (clearError) {
    return NextResponse.json({ error: clearError.message }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
  .from("addresses")
  .insert({
    user_id: userId,
    full_name: full_name.trim(),
    phone: phone.trim(),
    country: country.trim(),
    province: province.trim(),
    district:
      typeof district === "string" && district.trim()
        ? district.trim()
        : null,
    ward:
      typeof ward === "string" && ward.trim()
        ? ward.trim()
        : null,
    address_line: address_line.trim(),

    // ✅ FIX quan trọng ở đây
    postal_code:
      typeof postal_code === "string" && postal_code.trim()
        ? postal_code.trim()
        : null,

    label:
      label === "office" || label === "other"
        ? label
        : "home",

    is_default: true,
  })
  .select()
  .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, address: data });
}

/* =====================================================
   PUT – SET DEFAULT
===================================================== */
export async function PUT(req: Request) {
  const user = await getUserFromBearer();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("id" in body)) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  const { id } = body as { id?: unknown };

  if (typeof id !== "string") {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  /* Clear old default */
  const { error: clearError } = await supabaseAdmin
    .from("addresses")
    .update({ is_default: false })
    .eq("user_id", userId)

  if (clearError) {
    return NextResponse.json({ error: clearError.message }, { status: 500 });
  }

  /* Set new default */
  const { error } = await supabaseAdmin
    .from("addresses")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/* =====================================================
   DELETE
===================================================== */
export async function DELETE(req: Request) {
  const user = await getUserFromBearer();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("addresses")
    .delete()
    .eq("id", id)
   .eq("user_id", userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
