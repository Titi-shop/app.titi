import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guard";

import {
  getReturnsByBuyer,
  createReturn,
} from "@/lib/db/returns";

export const runtime = "nodejs";

/* =====================================================
   TYPES
===================================================== */

type CreateReturnBody = {
  orderId?: string;
  orderItemId?: string;
  reason?: string;
  description?: string;
  images?: string[];
};

/* =====================================================
   HELPERS
===================================================== */

function isValidUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function errorJson(
  code: string,
  status = 400
) {
  return NextResponse.json(
    { error: code },
    { status }
  );
}

function mapError(
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : "INTERNAL_ERROR";

  switch (message) {
    case "ORDER_NOT_FOUND":
      return errorJson(
        message,
        404
      );

    case "ITEM_NOT_FOUND":
      return errorJson(
        message,
        404
      );

    case "RETURN_EXISTS":
      return errorJson(
        message,
        409
      );

    case "ORDER_NOT_RETURNABLE":
      return errorJson(
        message,
        400
      );

    case "INVALID_INPUT":
      return errorJson(
        message,
        400
      );

    default:
      return errorJson(
        "INTERNAL_ERROR",
        500
      );
  }
}

/* =====================================================
   GET /api/returns
===================================================== */

export async function GET() {
  try {
    const auth =
      await requireAuth();

    if (!auth.ok) {
      return auth.response;
    }

    const userId =
      auth.userId;

    const items =
      await getReturnsByBuyer(
        userId
      );

    return NextResponse.json({
      items,
    });
  } catch (error) {
    return mapError(error);
  }
}

/* =====================================================
   POST /api/returns
===================================================== */

export async function POST(
  req: NextRequest
) {
  try {
    const auth =
      await requireAuth();

    if (!auth.ok) {
      return auth.response;
    }

    const userId =
      auth.userId;

    const body =
      (await req.json()) as CreateReturnBody;

    const orderId =
      body.orderId?.trim() ?? "";

    const orderItemId =
      body.orderItemId?.trim() ??
      "";

    const reason =
      body.reason?.trim() ?? "";

    const description =
      body.description?.trim() ??
      "";

    const images = Array.isArray(
      body.images
    )
      ? body.images.filter(
          (
            value
          ): value is string =>
            typeof value ===
              "string" &&
            value.trim()
              .length > 0
        )
      : [];

    /* ================= VALIDATE ================= */

    if (
      !orderId ||
      !orderItemId ||
      !reason
    ) {
      return errorJson(
        "INVALID_INPUT",
        400
      );
    }

    if (
      !isValidUuid(orderId) ||
      !isValidUuid(orderItemId)
    ) {
      return errorJson(
        "INVALID_UUID",
        400
      );
    }

    if (
      reason.length > 120
    ) {
      return errorJson(
        "INVALID_REASON",
        400
      );
    }

    if (
      description.length >
      2000
    ) {
      return errorJson(
        "INVALID_DESCRIPTION",
        400
      );
    }

    if (
      images.length > 10
    ) {
      return errorJson(
        "TOO_MANY_IMAGES",
        400
      );
    }

    const returnId =
      await createReturn(
        userId,
        orderId,
        orderItemId,
        reason,
        description,
        images
      );

    return NextResponse.json(
      {
        success: true,
        id: returnId,
      },
      { status: 201 }
    );
  } catch (error) {
    return mapError(error);
  }
}
