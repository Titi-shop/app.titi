
  import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import {
  listProductsService,
  createProductService,
  updateProductService,
  deleteProductService,
} from "@/lib/services/products.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================= GET ================= */
export async function GET(req: Request) {
  const result = await listProductsService(req);
  return NextResponse.json(result);
}

/* ================= POST ================= */
export async function POST(req: Request) {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const result = await createProductService(req, auth.userId);
  return NextResponse.json(result);
}

/* ================= PUT ================= */
export async function PUT(req: Request) {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const result = await updateProductService(req, auth.userId);
  return NextResponse.json(result);
}

/* ================= DELETE ================= */
export async function DELETE(req: Request) {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const result = await deleteProductService(req, auth.userId);
  return NextResponse.json(result);
}
