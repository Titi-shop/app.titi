import { NextRequest, NextResponse } from "next/server";

import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import {
  getProductDetailService,
} from "@/lib/services/products/detail";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } =
      await context.params;

    /* OPTIONAL AUTH */

    let userId: string | null =
      null;

    try {
      const auth =
        await getUserFromBearer(
          req
        );

      userId =
        auth?.userId ?? null;
    } catch {
      userId = null;
    }

    /* SERVICE */

    const result =
      await getProductDetailService(
        id,
        userId
      );

    return NextResponse.json(
      result
    );
  } catch (error) {
    console.error(
      "[API][PRODUCT_DETAIL]",
      error
    );

    return NextResponse.json(
      {
        error:
          "INTERNAL_ERROR",
      },
      {
        status: 500,
      }
    );
  }
}
