import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import {
  getReturnDetail,
  updateReturnStatus,
} from "@/lib/services/returns/seller.service";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireSeller();

  if (!auth.ok) {
    return auth.response;
  }

  const data = await getReturnDetail(
    params.id,
    auth.userId
  );

  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireSeller();

  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json();

  await updateReturnStatus(
    params.id,
    auth.userId,
    body.action
  );

  return NextResponse.json({
    success: true,
  });
}
