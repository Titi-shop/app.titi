// app/api/seller/register/route.ts

import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guard";
import { registerSeller } from "@/lib/services/sellerRequests.service";

import { logger, maskId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    /* ================= AUTH ================= */

    const auth = await requireAuth();

    if (!auth.ok) {
      return auth.response;
    }

    logger.info(
      "[SELLER] REGISTER_API",
      {
        userId: maskId(auth.userId),
      }
    );

    /* ================= SERVICE ================= */

    const result = await registerSeller(
      auth.userId,
      auth.role
    );

    /* ================= RESPONSE ================= */

    return NextResponse.json(
      result.body,
      {
        status: result.status,
      }
    );

  } catch (err) {

    logger.error(
      "[SELLER] REGISTER_FATAL",
      {
        code:
          err instanceof Error
            ? err.name
            : "UNKNOWN",
      }
    );

    return NextResponse.json(
      {
        error:
          "INTERNAL_SERVER_ERROR",
      },
      {
        status: 500,
      }
    );
  }
}
