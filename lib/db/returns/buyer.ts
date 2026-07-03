import {
  withTransaction,
} from "@/lib/db";

import {
  sendNotification,
} from "@/lib/services/notifications.service";

import {
  isValidUuid,
  error,
} from "./buyer.validator";

export {
  getReturnsByBuyer,
  getReturnByIdForBuyer,
} from "./buyer.query";

export {
  createReturn,
} from "./buyer.create";

/* =====================================================
   TYPES
===================================================== */

type DbOrder = {
  id: string;
  seller_id: string;
  fulfillment_status: string;
};

type DbOrderItem = {
  id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  product_slug: string;
  thumbnail: string;
  unit_price: string;
  quantity: number;
};

type DbReturn = {
  id: string;
  return_number: string;
  status: string;
  refund_amount: string;
  currency: string;
  created_at: string;
};

/* =====================================================
   CANCEL RETURN
===================================================== */

export async function cancelReturnByBuyer(
  returnId: string,
  buyerId: string
): Promise<boolean> {

  if (
    !isValidUuid(returnId) ||
    !isValidUuid(buyerId)
  ) {
    error("INVALID_INPUT");
  }

  try {

    const result =
      await withTransaction(
        async (client) => {

          /* ==========================================
             LOAD RETURN
          ========================================== */

          const {
            rows,
          } =
            await client.query<{
              seller_id: string;
            }>(
              `
              SELECT
                seller_id
              FROM returns
              WHERE id = $1
                AND buyer_id = $2
                AND status = 'pending'
                AND deleted_at IS NULL
              LIMIT 1
              `,
              [
                returnId,
                buyerId,
              ]
            );

          const ret = rows[0];

          if (!ret) {

            return {
              success: false,
            };

          }

          /* ==========================================
             CANCEL RETURN
          ========================================== */

          const update =
            await client.query(
              `
              UPDATE returns
              SET
                status = 'cancelled',
                cancelled_at = NOW(),
                updated_at = NOW()
              WHERE id = $1
              `,
              [returnId]
            );

          return {
            success:
              update.rowCount > 0,

            buyerId,

            sellerId:
              ret.seller_id,

            returnId,
          };
        }
      );

    /* ==========================================
       NOTIFICATIONS
    ========================================== */

    if (result.success) {

      try {

        await sendNotification({
          userId: result.buyerId!,
          type: "return_cancelled",
          category: "order",
          title: "Bạn đã hủy yêu cầu trả hàng",
          message:
            "Yêu cầu trả hàng của bạn đã được hủy.",
          priority: "normal",
        });

        await sendNotification({
          userId: result.sellerId!,
          type: "return_cancelled",
          category: "order",
          title: "Người mua đã hủy yêu cầu trả hàng",
          message:
            "Yêu cầu trả hàng đã được người mua hủy.",
          priority: "normal",
        });

      } catch (err) {

        console.error(
          "[NOTIFICATION][RETURN_CANCELLED]",
          err
        );

      }

    }

    return result.success;

  } catch (err) {

    console.error(
      "[RETURN][BUYER][CANCEL]",
      {
        message:
          err instanceof Error
            ? err.message
            : "UNKNOWN",
      }
    );

    throw err;
  }
}

/* =====================================================
   SHIP RETURN
===================================================== */

export async function shipReturnByBuyer(
  params: {
    returnId: string;
    buyerId: string;
    trackingCode: string;
    shippingProvider: string | null;
  }
): Promise<boolean> {

  const {
    returnId,
    buyerId,
    trackingCode,
    shippingProvider,
  } = params;

  if (
    !isValidUuid(returnId) ||
    !isValidUuid(buyerId)
  ) {
    throw new Error("INVALID_INPUT");
  }

  try {

    const result =
      await withTransaction(
        async (client) => {

          /* ==========================================
             LOAD RETURN
          ========================================== */

          const { rows } =
            await client.query<{
              buyer_id: string;
              seller_id: string;
              status: string;
            }>(
              `
              SELECT
                buyer_id,
                seller_id,
                status
              FROM returns
              WHERE id = $1
                AND buyer_id = $2
                AND deleted_at IS NULL
              LIMIT 1
              `,
              [
                returnId,
                buyerId,
              ]
            );

          const ret = rows[0];

          if (!ret) {
            throw new Error("NOT_FOUND");
          }

          if (ret.status !== "approved") {
            throw new Error("INVALID_STATE");
          }

          /* ==========================================
             UPDATE RETURN
          ========================================== */

          const update =
            await client.query(
              `
              UPDATE returns
              SET
                status = 'shipping_back',
                return_tracking_code = $1,
                return_shipping_provider = $2,
                shipped_back_at = NOW(),
                updated_at = NOW()
              WHERE id = $3
              `,
              [
                trackingCode,
                shippingProvider,
                returnId,
              ]
            );

          if (update.rowCount === 0) {

            return {
              success: false,
            };

          }

          console.log(
            "[RETURN][BUYER][SHIP]",
            {
              returnId,
              buyerId,
            }
          );

          return {
            success: true,
            buyerId: ret.buyer_id,
            sellerId: ret.seller_id,
            returnId,
          };
        }
      );

    /* ==========================================
       NOTIFICATIONS
    ========================================== */

    if (result.success) {

      try {

        await sendNotification({
          userId: result.buyerId!,
          type: "return_created",
          category: "order",
          title: "Bạn đã gửi hàng trả",
          message:
            "Hàng hoàn trả đang được vận chuyển tới người bán.",
          priority: "normal",
        });

        await sendNotification({
          userId: result.sellerId!,
          type: "return_created",
          category: "order",
          title: "Người mua đã gửi hàng trả",
          message:
            "Người mua đã gửi hàng hoàn trả, vui lòng theo dõi để nhận hàng.",
          priority: "high",
        });

      } catch (err) {

        console.error(
          "[NOTIFICATION][RETURN_SHIPPING]",
          err
        );

      }

    }

    return result.success;

  } catch (err) {

    console.error(
      "[RETURN][BUYER][SHIP]",
      {
        message:
          err instanceof Error
            ? err.message
            : "UNKNOWN",
      }
    );

    throw err;
  }
}
