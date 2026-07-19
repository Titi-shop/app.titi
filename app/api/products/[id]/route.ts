import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import {
  getProductService,
  updateProductService,
  deleteProductService,
} from "@/lib/services/products/by-id";
import {
  maskId,
} from "@/lib/db/products/helpers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================= GET ================= */
export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const start = Date.now();

  const auth = await getUserFromBearer();
  const userId = auth?.userId ?? null;

  const result = await getProductService(
    ctx.params.id,
    userId
  );

  console.log(
    "[API TOTAL]",
    Date.now() - start,
    "ms"
  );

  return NextResponse.json(result);
}
/* ================= PATCH ================= */
export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const result = await updateProductService(
    ctx.params.id,
    auth.userId,
    await req.json()
  );
console.log(
  "[API][PRODUCTS][PATCH_DONE]",
  {
    productId:
      maskId(ctx.params.id),
  }
);
  return NextResponse.json(result);
}

/* ================= DELETE ================= */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string } }
) {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const result = await deleteProductService(
    ctx.params.id,
    auth.userId
  );
console.log(
  "[API][PRODUCTS][DELETE_DONE]",
  {
    productId:
      maskId(ctx.params.id),
  }
);
  return NextResponse.json(result);
}
