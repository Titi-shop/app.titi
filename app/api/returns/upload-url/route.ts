import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAuth } from "@/lib/auth/guard";

export const runtime = "nodejs";

export async function POST() {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();

    if (!auth.ok) {
      return auth.response;
    }

    const userId = auth.userId;

    /* ================= PATH ================= */
    const fileName = `${Date.now()}-${crypto.randomUUID()}.jpg`;

    const filePath = `returns/${userId}/${fileName}`;

    /* ================= SIGNED URL ================= */
    const { data, error } = await supabaseAdmin.storage
      .from("returns")
      .createSignedUploadUrl(filePath);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: "SIGNED_URL_FAILED" },
        { status: 500 }
      );
    }

    /* ================= PUBLIC URL ================= */
    const publicUrl =
      `${process.env.SUPABASE_URL}/storage/v1/object/public/returns/${filePath}`;

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      publicUrl,
    });

  } catch {
    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
