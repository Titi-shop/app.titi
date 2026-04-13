import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSeller } from "@/lib/auth/guard";

export async function POST() {
  try {
    console.log("🚀 CREATE SIGNED URL");

    /* ===== AUTH ===== */
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ===== PATH ===== */
    const filePath = `products/${userId}/${crypto.randomUUID()}.jpg`;

    console.log("📂 PATH:", filePath);

    /* ===== SIGNED URL ===== */
    const { data, error } = await supabaseAdmin.storage
      .from("products")
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("❌ SIGNED URL ERROR:", error);
      return NextResponse.json({ error: "FAILED" }, { status: 500 });
    }

    console.log("✅ SIGNED URL CREATED");

    return NextResponse.json({
      url: data.signedUrl,
      path: filePath,
    });

  } catch (err) {
    console.error("💥 API ERROR:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
