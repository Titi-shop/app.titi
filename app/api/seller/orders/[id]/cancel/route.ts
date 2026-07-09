import { NextResponse } from "next/server";

import { requireSeller } from "@/lib/auth/guard";

import {
  cancelOrderBySeller,
} from "@/lib/db/orders.seller";

import {
  logger,
} from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidId(
  v: unknown
): v is string {
  return (
    typeof v === "string" &&
    v.length > 10
  );
}

export async function PATCH(
  req: Request,
  {
    params,
  }: {
    params: {
      id: string;
    };
  }
) {
  try {

    const auth =
      await requireSeller();

    if (!auth.ok) {
      return auth.response;
    }

    const orderId =
      params?.id;

    if (
      !isValidId(orderId)
    ) {

      logger.warn(
        "ORDER.CANCEL.INVALID_ID"
      );

      return NextResponse.json(
        {
          error:
            "INVALID_ORDER_ID",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      await req
        .json()
        .catch(() => ({}));

    const cancelReason =
      typeof body?.cancel_reason ===
      "string"
        ? body.cancel_reason.trim()
        : null;

    logger.info(
      "ORDER.CANCEL.START"
    );

    const result =
      await cancelOrderBySeller(
        orderId,
        auth.userId,
        cancelReason
      );

    if (!result.success) {

      logger.warn(
        "ORDER.CANCEL.NO_UPDATE"
      );

      return NextResponse.json(
        {
          error:
            "NOTHING_UPDATED",
        },
        {
          status: 400,
        }
      );
    }

    logger.info(
      "ORDER.CANCEL.SUCCESS"
    );

    return NextResponse.json({
      success: true,
    });

  } catch (error) {

    logger.error(
      "ORDER.CANCEL.ERROR",
      {
        message:
          error instanceof Error
            ? error.message
            : "UNKNOWN_ERROR",
      }
    );

    return NextResponse.json(
      {
        error: "FAILED",
      },
      {
        status: 500,
      }
    );
  }
}
