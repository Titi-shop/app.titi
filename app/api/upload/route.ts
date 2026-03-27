import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    /* =========================
       1️⃣ AUTH
    ========================= */
    const user = await getUserFromBearer();

    if (!user?.pi_uid) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    /* =========================
       2️⃣ MAP USER
    ========================= */
    const userRes = await query(
      `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
      [user.pi_uid]
    );

    if (userRes.rowCount === 0) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const userId = userRes.rows[0].id;

    /* =========================
       3️⃣ ROLE CHECK
    ========================= */
    const roleRes = await query(
      `SELECT role FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    const role = roleRes.rows[0]?.role;

    if (role !== "seller" && role !== "admin") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    /* =========================
       4️⃣ FILE
    ========================= */
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "INVALID_FILE" },
        { status: 400 }
      );
    }

    // ✅ SIZE LIMIT
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "FILE_TOO_LARGE" },
        { status: 400 }
      );
    }

    // ✅ TYPE CHECK
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "INVALID_FILE_TYPE" },
        { status: 400 }
      );
    }

    /* =========================
       5️⃣ PATH
    ========================= */
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";

    const filePath = `products/${userId}/${crypto.randomUUID()}.${ext}`;

    /* =========================
       6️⃣ UPLOAD
    ========================= */
    const { error } = await supabase.storage
      .from("products")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("❌ Supabase upload error:", error);

      return NextResponse.json(
        { error: "UPLOAD_FAILED" },
        { status: 500 }
      );
    }

    /* =========================
       7️⃣ URL
    ========================= */
    const { data } = supabase.storage
      .from("products")
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: data.publicUrl,
    });

  } catch (err) {
    console.error("❌ Upload error:", err);

    return NextResponse.json(
      { error: "UPLOAD_FAILED" },
      { status: 500 }
    );
  }
}
