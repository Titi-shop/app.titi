import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import {
  createReturn,
  getReturnsByBuyer,
} from "@/lib/db/orders";

export const dynamic = "force-dynamic";

/* =========================================================
   POST — CREATE RETURN
========================================================= */
export async function POST(req: NextRequest) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= PARSE ================= */
    const contentType = req.headers.get("content-type") ?? "";

    let orderId: string | null = null;
    let orderItemId: string | null = null;
    let reason: string | null = null;
    let description: string | null = null;
    let images: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();

      orderId = form.get("order_id") as string;
      orderItemId = form.get("order_item_id") as string;
      reason = (form.get("reason") as string)?.trim();
      description = (form.get("description") as string)?.trim();

      const files = form.getAll("images");

      for (const file of files) {
        if (!(file instanceof File)) continue;

        if (file.size > 2 * 1024 * 1024) {
          return NextResponse.json(
            { error: "IMAGE_TOO_LARGE" },
            { status: 400 }
          );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString("base64");
        const mime = file.type || "image/jpeg";

        images.push(`data:${mime};base64,${base64}`);
      }
    } else {
      const body = await req.json();

      orderId = body.order_id;
      orderItemId = body.order_item_id;
      reason = body.reason?.trim();
      description = body.description?.trim();
    }

    /* ================= VALIDATE ================= */
    if (!orderId || !orderItemId || !reason) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    if (images.length > 3) {
      return NextResponse.json(
        { error: "MAX_3_IMAGES" },
        { status: 400 }
      );
    }

    /* ================= DB ================= */
    await createReturn(
      userId,
      orderId,
      orderItemId,
      reason,
      description,
      images
    );

    return NextResponse.json({
      success: true,
    });

  } catch (err) {
    console.error("RETURN CREATE ERROR:", err);

    if (err instanceof Error) {
      return NextResponse.json(
        { error: err.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}

/* =========================================================
   GET — BUYER RETURNS
========================================================= */
export async function GET() {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= DB ================= */
    const data = await getReturnsByBuyer(userId);

    return NextResponse.json(data);

  } catch (err) {
    console.error("GET RETURNS ERROR:", err);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
