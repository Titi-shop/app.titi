// =====================================================
// app/api/wallet/withdraw/route.ts
// =====================================================

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getUserFromBearer,
} from "@/lib/auth/getUserFromBearer";

import {
  createWithdrawal,
} from "@/lib/services/wallet.withdraw.service";

import {
  getUserWithdrawHistory,
  getUserWithdrawHistoryDetail,
} from "@/lib/services/wallet.withdraw.history.service";

import {
  logger,
  maskId,
} from "@/lib/logger";

export const runtime =
  "nodejs";

/* =====================================================
   TYPES
===================================================== */

type RequestBody = {
  amount?: unknown;
  walletAddressId?: unknown;
};

/* =====================================================
   HELPERS
===================================================== */

async function authenticate() {
  return getUserFromBearer();
}

/* =====================================================
   GET
===================================================== */

export async function GET(
  request: NextRequest
) {
  logger.info(
    "WALLET.WITHDRAW.GET.START"
  );

  try {
    const auth =
      await authenticate();

    if (!auth) {
      logger.warn(
        "WALLET.WITHDRAW.GET.UNAUTHORIZED"
      );

      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    logger.debug(
      "WALLET.WITHDRAW.GET.AUTH_OK",
      {
        userId: maskId(
          auth.userId
        ),
      }
    );

    const withdrawalId =
      request.nextUrl.searchParams.get(
        "id"
      );

    /* ===============================================
       DETAIL
    =============================================== */

    if (
      withdrawalId?.trim()
    ) {
      logger.debug(
        "WALLET.WITHDRAW.GET.DETAIL",
        {
          withdrawalId: maskId(
            withdrawalId
          ),
        }
      );

      const item =
        await getUserWithdrawHistoryDetail(
          withdrawalId,
          auth.userId
        );

      if (!item) {
        logger.warn(
          "WALLET.WITHDRAW.GET.NOT_FOUND",
          {
            withdrawalId: maskId(
              withdrawalId
            ),
          }
        );

        return NextResponse.json(
          { error: "NOT_FOUND" },
          { status: 404 }
        );
      }

      logger.info(
        "WALLET.WITHDRAW.GET.DETAIL_OK",
        {
          withdrawalId: maskId(
            withdrawalId
          ),
        }
      );

      return NextResponse.json({
        success: true,
        item,
      });
    }

    /* ===============================================
       LIST
    =============================================== */

    logger.debug(
      "WALLET.WITHDRAW.GET.LIST"
    );

    const items =
      await getUserWithdrawHistory(
        auth.userId
      );

    logger.info(
      "WALLET.WITHDRAW.GET.LIST_OK",
      {
        total: items.length,
      }
    );

    return NextResponse.json({
      success: true,
      items,
    });
      } catch (error) {
    logger.error(
      "WALLET.WITHDRAW.GET.ERROR",
      {
        message:
          error instanceof Error
            ? error.message
            : "UNKNOWN_ERROR",
      }
    );

    if (
      process.env.NODE_ENV !==
      "production"
    ) {
      console.error(error);
    }

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

/* =====================================================
   POST
===================================================== */

export async function POST(
  request: NextRequest
) {
  logger.info(
    "WALLET.WITHDRAW.POST.START"
  );

  try {
    const auth =
      await authenticate();

    if (!auth) {
      logger.warn(
        "WALLET.WITHDRAW.POST.UNAUTHORIZED"
      );

      return NextResponse.json(
        {
          error:
            "UNAUTHORIZED",
        },
        {
          status: 401,
        }
      );
    }

    logger.debug(
      "WALLET.WITHDRAW.POST.AUTH_OK",
      {
        userId: maskId(
          auth.userId
        ),
      }
    );

    const body: unknown =
      await request.json();

    if (
      typeof body !==
        "object" ||
      body === null
    ) {
      logger.warn(
        "WALLET.WITHDRAW.POST.INVALID_BODY"
      );

      return NextResponse.json(
        {
          error:
            "INVALID_BODY",
        },
        {
          status: 400,
        }
      );
    }

    const data =
      body as RequestBody;

    logger.debug(
      "WALLET.WITHDRAW.POST.CREATE_START"
    );

    const withdrawal =
      await createWithdrawal({
        userId:
          auth.userId,
        amount: Number(
          data.amount
        ),
        walletAddressId:
          typeof data.walletAddressId ===
          "string"
            ? data.walletAddressId.trim()
            : "",
      });

    logger.info(
      "WALLET.WITHDRAW.POST.SUCCESS",
      {
        userId: maskId(
          auth.userId
        ),
        withdrawalId:
          maskId(
            withdrawal.id
          ),
      }
    );

    return NextResponse.json({
      success: true,
      withdrawalId:
        withdrawal.id,
    });
      } catch (error) {
    logger.error(
      "WALLET.WITHDRAW.POST.ERROR",
      {
        message:
          error instanceof Error
            ? error.message
            : "UNKNOWN_ERROR",
      }
    );

    if (
      process.env.NODE_ENV !==
      "production"
    ) {
      console.error(error);
    }

    if (
      error instanceof Error
    ) {
      switch (
        error.message
      ) {
        case "INVALID_AMOUNT":
        case "INVALID_WALLET":
        case "INVALID_USER":
          return NextResponse.json(
            {
              error:
                error.message,
            },
            {
              status: 400,
            }
          );
      }
    }

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
