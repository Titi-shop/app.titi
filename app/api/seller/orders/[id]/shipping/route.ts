import { NextResponse } from "next/server";

import { requireSeller } from "@/lib/auth/guard";

import {
  startShippingBySeller,
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
  _req: Request,
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
        "ORDER.SHIP.INVALID_ID"
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

    logger.info(
      "ORDER.SHIP.START"
    );

    const updated =
      await startShippingBySeller(
        orderId,
        auth.userId
      );

    if (!updated) {

      logger.warn(
        "ORDER.SHIP.NO_UPDATE"
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
      "ORDER.SHIP.SUCCESS"
    );

    return NextResponse.json({
      success: true,
      message:
        "ORDER_ITEMS_SHIPPING",
    });

  } catch (error) {

    logger.error(
      "ORDER.SHIP.ERROR",
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
