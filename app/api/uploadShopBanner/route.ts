import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import {
  getUserShopBanner,
  updateShopBanner,
} from "@/lib/db/userProfiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
};

export async function POST(req: Request): Promise<NextResponse> {
  try {
    /* ================= AUTH ================= */
    const user = await getUserFromBearer(req);

    if (!user?.pi_uid) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    /* ================= MAP USER ================= */
    const userRes = await query<UserRow>(
      `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
      [user.pi_uid]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const userId = userRes.rows[0].id;

    /* ================= FILE ================= */
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "INVALID_FILE" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "INVALID_FILE_TYPE" },
        { status: 400 }
      );
    }

    /* ================= LOAD OLD ================= */
    const oldBanner = await getUserShopBanner(userId);

    /* ================= DELETE OLD ================= */
    if (oldBanner) {
      try {
        const url = new URL(oldBanner);
        await del(url.pathname);
      } catch (err) {
        console.warn("⚠️ Failed to delete old banner:", err);
      }
    }

    /* ================= UPLOAD ================= */
    const blob = await put(
      `shop-banners/${userId}-${Date.now()}`,
      file,
      {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      }
    );

    /* ================= SAVE ================= */
    await updateShopBanner(userId, blob.url);

    /* ================= RESPONSE ================= */
    return NextResponse.json({
      success: true,
      banner: `${blob.url}?t=${Date.now()}`,
    });

  } catch (err) {
    console.error("❌ UPLOAD SHOP BANNER ERROR:", err);

    return NextResponse.json(
      { error: "UPLOAD_FAILED" },
      { status: 500 }
    );
  }
}
