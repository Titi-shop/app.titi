
import { NextRequest, NextResponse } from "next/server";
import { updateProductBySeller } from "@/lib/db/products";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { query } from "@/lib/db";
import {
  getVariantsByProductId,
  replaceVariantsByProductId,
  type ProductVariant,
} from "@/lib/db/variants";

/* =========================
   TYPES
========================= */
type UserRow = {
  id: string;
  role: "seller" | "admin" | "customer";
};

/* =========================
   PATCH
========================= */
export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const id = context?.params?.id;

    /* =========================
       1️⃣ AUTH
    ========================= */
    const user = await getUserFromBearer(req); // ✅ FIX

    if (!user?.pi_uid) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    /* =========================
       2️⃣ MAP USER + ROLE
    ========================= */
    const userRes = await query<UserRow>(
      `SELECT id, role FROM users WHERE pi_uid = $1 LIMIT 1`,
      [user.pi_uid]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const { id: userId, role } = userRes.rows[0];

    if (role !== "seller" && role !== "admin") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    /* =========================
       3️⃣ VALIDATE ID
    ========================= */
    if (!id) {
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    /* =========================
       4️⃣ CHECK OWNERSHIP
    ========================= */
    const ownerCheck = await query<{ seller_id: string }>(
      `SELECT seller_id FROM products WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (ownerCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const sellerId = ownerCheck.rows[0].seller_id;

    if (sellerId !== userId && role !== "admin") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    /* =========================
       5️⃣ BODY
    ========================= */
    const body = await req.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    /* =========================
       6️⃣ VARIANTS
    ========================= */
    const normalizedVariants = Array.isArray(body.variants)
      ? normalizeVariants(body.variants)
      : [];

    const hasVariants = normalizedVariants.length > 0;

    const finalStock = hasVariants
      ? normalizedVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
      : typeof body.stock === "number" && body.stock >= 0
      ? body.stock
      : 0;

    /* =========================
       7️⃣ PAYLOAD
    ========================= */
    const updatePayload = Object.fromEntries(
      Object.entries({
        name: body.name,
        description: body.description,
        detail: body.detail,
        images: body.images,
        category_id: body.categoryId,
        price: body.price,
        sale_price: body.salePrice,
        sale_start: body.saleStart,
        sale_end: body.saleEnd,
        stock: finalStock,
        is_active: body.is_active,
        thumbnail: body.thumbnail,
      }).filter(([_, v]) => v !== undefined)
    );

    /* =========================
       8️⃣ UPDATE
    ========================= */
    const updated = await updateProductBySeller(
      userId,
      id,
      updatePayload
    );

    if (!updated) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 }
      );
    }

    /* =========================
       9️⃣ VARIANTS UPDATE
    ========================= */
    if (Array.isArray(body.variants)) {
      await replaceVariantsByProductId(id, normalizedVariants);
    }

    const updatedVariants = await getVariantsByProductId(id);

    /* =========================
       🔟 FETCH PRODUCT
    ========================= */
    const result = await query(
      `SELECT * FROM products WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const p = result.rows[0];

    /* =========================
       ✅ RESPONSE
    ========================= */
    return NextResponse.json({
      id: p.id,
      name: p.name,
      price: p.price,
      salePrice: p.sale_price ?? null,
      saleStart: p.sale_start ?? null,
      saleEnd: p.sale_end ?? null,
      description: p.description ?? "",
      detail: p.detail ?? "",
      images: p.images ?? [],
      thumbnail: p.thumbnail ?? (p.images?.[0] ?? ""),
      categoryId: p.category_id ?? "",
      stock: p.stock ?? 0,
      is_active: p.is_active ?? true,
      views: p.views ?? 0,
      sold: p.sold ?? 0,
      rating_avg: p.rating_avg ?? 0,
      rating_count: p.rating_count ?? 0,
      variants: updatedVariants,
    });

  } catch (err) {
    console.error("❌ PRODUCT PATCH ERROR:", err);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}


export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const id = context?.params?.id;

    if (!id) {
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    const result = await query(
      `SELECT * FROM products WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);

  } catch (err) {
    console.error("❌ GET PRODUCT ERROR:", err);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
