import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAuth } from "@/lib/auth/guard";

export const runtime = "nodejs";

export async function POST() {
  console.log("🚀 [UPLOAD_URL] START");

  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();

    console.log("🔐 [UPLOAD_URL] AUTH:", auth);

    if (!auth?.ok) {
      console.error("❌ [UPLOAD_URL] UNAUTHORIZED");
      return auth.response ?? NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    if (!userId) {
      console.error("❌ [UPLOAD_URL] NO USER");
      return NextResponse.json(
        { error: "NO_USER" },
        { status: 401 }
      );
    }

    console.log("👤 [UPLOAD_URL] USER:", userId);

    /* ================= PATH ================= */
    const fileName = `${Date.now()}-${crypto.randomUUID()}.jpg`;

    // 🔥 dùng folder returns riêng (chuẩn hệ thống)
    const filePath = `returns/${userId}/${fileName}`;

    console.log("📂 [UPLOAD_URL] PATH:", filePath);

    /* ================= SIGNED URL ================= */
    const { data, error } = await supabaseAdmin.storage
      .from("returns") // ⚠️ bucket riêng
      .createSignedUploadUrl(filePath);

    if (error || !data?.signedUrl) {
      console.error("❌ [UPLOAD_URL] SIGN ERROR:", error);
      return NextResponse.json(
        { error: "SIGNED_URL_FAILED" },
        { status: 500 }
      );
    }

    console.log("✅ [UPLOAD_URL] SIGNED URL OK");

    /* ================= PUBLIC URL ================= */
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!baseUrl) {
      console.error("❌ [UPLOAD_URL] MISSING ENV");
      return NextResponse.json(
        { error: "CONFIG_ERROR" },
        { status: 500 }
      );
    }

    const publicUrl = `${baseUrl}/storage/v1/object/public/returns/${filePath}`;

    console.log("🌍 [UPLOAD_URL] PUBLIC URL:", publicUrl);

    /* ================= RESPONSE ================= */
    return NextResponse.json({
      uploadUrl: data.signedUrl, // 🔥 frontend dùng PUT
      publicUrl,                 // 🔥 lưu DB
      path: filePath,            // optional debug
    });

  } catch (err: unknown) {
    console.error("💥 [UPLOAD_URL] ERROR:", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
