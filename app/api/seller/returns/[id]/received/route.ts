

import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";

import {
  markReturnReceived,
} from "@/lib/services/returns/seller.service";

export const runtime = "nodejs";

/* ================= HELPERS ================= */

function errorJson(code: string, status = 400) {
  return NextResponse.json(
    { error: code },
    { status }
  );
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

/* ================= POST ================= */

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireSeller();

    if (!auth.ok) {
      return auth.response;
    }

    const returnId = params.id;

    if (!isValidUuid(returnId)) {
      return errorJson("INVALID_RETURN_ID");
    }

    await markReturnReceived(
      returnId,
      auth.userId
    );

    return NextResponse.json({
      success: true,
    });

  } catch (error) {

    console.error(
      "[SELLER_RETURN_RECEIVED]",
      error
    );

    const code =
      error instanceof Error
        ? error.message
        : "INTERNAL_SERVER_ERROR";

    const status =
      code === "NOT_FOUND"
        ? 404
        : code === "INVALID_STATUS"
        ? 400
        : code === "UPDATE_FAILED"
        ? 400
        : 500;

    return errorJson(code, status);
  }
}
