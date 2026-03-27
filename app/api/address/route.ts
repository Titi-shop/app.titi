import { NextResponse } from "next/server";
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
   HELPER: GET USER ID (UUID)
===================================================== */
async function getUserId(pi_uid: string) {
  const res = await query(
    `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
    [pi_uid]
  );

  if (res.rowCount === 0) return null;

  return res.rows[0].id as string;
}

/* =====================================================
   GET – LIST
===================================================== */
import { getAddressesByUser } from "@/lib/db/addresses";

export async function GET(req: Request) {
  const user = await getUserFromBearer(req);

  if (!user?.pi_uid) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userRes = await query(
    `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
    [user.pi_uid]
  );

  if (userRes.rowCount === 0) {
    return NextResponse.json({ success: true, items: [] });
  }

  const userId = userRes.rows[0].id;

  const items = await getAddressesByUser(userId);

  return NextResponse.json({
    success: true,
    items,
  });
}

/* =====================================================
   POST – CREATE
===================================================== */
import { createAddress } from "@/lib/db/addresses";

const address = await createAddress(userId, {
  full_name: full_name.trim(),
  phone: phone.trim(),
  country: country.trim(),
  province: province.trim(),
  district: district?.trim() || null,
  ward: ward?.trim() || null,
  address_line: address_line.trim(),
  postal_code: postal_code?.trim() || null,
  label: label === "office" || label === "other" ? label : "home",
});

/* =====================================================
   PUT – SET DEFAULT
===================================================== */
import { setDefaultAddress } from "@/lib/db/addresses";

await setDefaultAddress(userId, id);

/* =====================================================
   DELETE
===================================================== */
import { deleteAddress } from "@/lib/db/addresses";

await deleteAddress(userId, id);
