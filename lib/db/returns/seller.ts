import { query, withTransaction } from "@/lib/db";
import {
  sendNotification,
} from "@/lib/services/notifications.service";
import type {
  ReturnStatus,
  TimelineItem,
  ReturnItem,
  SellerReturnDetail,
} from "./seller.types";
export {
  getReturnsBySeller,
  getReturnByIdForSeller,
} from "./seller.query";
import {
  buildTimeline,
} from "./seller.timeline";

/* =====================================================
   HELPERS
===================================================== */

function isValidUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

/* =====================================================
   APPROVE RETURN
===================================================== */

export async function approveReturnBySeller(
  returnId: string,
  sellerId: string
): Promise<boolean> {

  if (
    !isValidUuid(returnId) ||
    !isValidUuid(sellerId)
  ) {
    throw new Error("INVALID_INPUT");
  }

  try {
    const result =
  await withTransaction(
      async (client) => {

        const {
          rows: addrRows,
        } =
          await client.query<{
            id: string;
          }>(
            `
            SELECT id

            FROM seller_addresses

            WHERE seller_id = $1
              AND is_active = true

            ORDER BY
              CASE
                WHEN type = 'return'
                  THEN 1

                WHEN type = 'pickup'
                  THEN 2

                ELSE 3
              END

            LIMIT 1
            `,
            [sellerId]
          );

        const returnAddressId =
          addrRows[0]?.id;

        if (
          !returnAddressId
        ) {
          throw new Error(
            "RETURN_ADDRESS_REQUIRED"
          );
        }
const { rows: returnRows } =
  await client.query<{
    buyer_id: string;
  }>(
    `
    SELECT buyer_id
    FROM returns
    WHERE id = $1
    LIMIT 1
    `,
    [returnId]
  );

const buyerId =
  returnRows[0]?.buyer_id;

if (!buyerId) {
  throw new Error(
    "BUYER_NOT_FOUND"
  );
}
        const res =
          await client.query(
            `
            UPDATE returns

            SET
              status = 'approved',
              return_address_id = $1,
              approved_at = NOW(),
              updated_at = NOW()

            WHERE id = $2
              AND seller_id = $3
              AND status = 'pending'
              AND deleted_at IS NULL
            `,
            [
              returnAddressId,
              returnId,
              sellerId,
            ]
          );

        return {
  success: res.rowCount > 0,
  buyerId,
  sellerId,
};
         
      }
    );
if (result.success) {

  try {
await sendNotification({
  userId: result.sellerId,
  type: "return_approved",
  category: "order",
  title: "Bạn đã chấp nhận yêu cầu trả hàng",
  message: "Địa chỉ trả hàng đã được gửi cho người mua.",
  priority: "normal",
});
    await sendNotification({
      userId: result.buyerId,
      type: "return_approved",
      category: "order",
      title: "Yêu cầu trả hàng đã được chấp nhận",
      message:
        "Người bán đã chấp nhận yêu cầu trả hàng của bạn.",
      priority: "high",
    });

  } catch (err) {

    console.error(
      "[NOTIFICATION][RETURN_APPROVED]",
      err
    );

  }

}

return result.success;
  } catch (error) {
    console.error(
      "[RETURN][APPROVE]",
      {
        message:
          error instanceof
          Error
            ? error.message
            : "UNKNOWN",
      }
    );

    throw error;
  }
}

/* =====================================================
   REJECT RETURN
===================================================== */

export async function rejectReturnBySeller(
  returnId: string,
  sellerId: string
): Promise<boolean> {

  if (
    !isValidUuid(returnId) ||
    !isValidUuid(sellerId)
  ) {
    throw new Error("INVALID_INPUT");
  }

  try {

    const result =
      await withTransaction(
        async (client) => {

          /* ==========================================
             GET RETURN
          ========================================== */

          const { rows } =
            await client.query<{
              buyer_id: string;
            }>(
              `
              SELECT buyer_id
              FROM returns
              WHERE id = $1
                AND seller_id = $2
                AND deleted_at IS NULL
              LIMIT 1
              `,
              [
                returnId,
                sellerId,
              ]
            );

          const ret = rows[0];

          if (!ret) {
            return {
              success: false,
            };
          }

          /* ==========================================
             UPDATE RETURN
          ========================================== */

          const res =
            await client.query(
              `
              UPDATE returns
              SET
                status = 'rejected',
                rejected_at = NOW(),
                updated_at = NOW()
              WHERE id = $1
                AND seller_id = $2
                AND status = 'pending'
                AND deleted_at IS NULL
              `,
              [
                returnId,
                sellerId,
              ]
            );

          return {
            success: res.rowCount > 0,
            buyerId: ret.buyer_id,
            sellerId,
          };
        }
      );

    /* ==========================================
       NOTIFICATION
    ========================================== */

    if (result.success) {

      try {

        await sendNotification({
          userId: result.sellerId!,
          type: "return_rejected",
          category: "order",
          title: "Bạn đã từ chối yêu cầu trả hàng",
          message:
            "Yêu cầu trả hàng đã bị từ chối.",
          priority: "normal",
        });

        await sendNotification({
          userId: result.buyerId!,
          type: "return_rejected",
          category: "order",
          title: "Yêu cầu trả hàng đã bị từ chối",
          message:
            "Người bán đã từ chối yêu cầu trả hàng của bạn.",
          priority: "high",
        });

      } catch (err) {

        console.error(
          "[NOTIFICATION][RETURN_REJECTED]",
          err
        );

      }

    }

    return result.success;

  } catch (error) {

    console.error(
      "[RETURN][REJECT]",
      {
        message:
          error instanceof Error
            ? error.message
            : "UNKNOWN",
      }
    );

    throw error;
  }
}

/* =====================================================
   MARK RETURN RECEIVED
===================================================== */

export async function markReturnReceivedBySeller(
  returnId: string,
  sellerId: string
): Promise<boolean> {

  if (
    !isValidUuid(returnId) ||
    !isValidUuid(sellerId)
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

          const {
            rows,
          } =
            await client.query<{
              refund_amount: string;
              order_id: string;
              seller_id: string;
            }>(
              `
              SELECT
                refund_amount,
                order_id,
                seller_id
              FROM returns
              WHERE id = $1
                AND seller_id = $2
                AND status = 'shipping_back'
                AND deleted_at IS NULL
              FOR UPDATE
              `,
              [
                returnId,
                sellerId,
              ]
            );

          const ret = rows[0];

          if (!ret) {
            return {
              success: false,
            };
          }

          const amount =
            Number(
              ret.refund_amount ?? 0
            );

          if (
            !Number.isFinite(amount) ||
            amount <= 0
          ) {
            throw new Error(
              "INVALID_AMOUNT"
            );
          }

          /* ==========================================
             LOAD BUYER
          ========================================== */

          const {
            rows: orderRows,
          } =
            await client.query<{
              buyer_id: string;
            }>(
              `
              SELECT buyer_id
              FROM orders
              WHERE id = $1
              LIMIT 1
              `,
              [ret.order_id]
            );

          const buyerId =
            orderRows[0]?.buyer_id;

          if (!buyerId) {
            throw new Error(
              "BUYER_NOT_FOUND"
            );
          }

          /* ==========================================
             ENSURE WALLET
          ========================================== */

          await client.query(
            `
            INSERT INTO wallets (
              user_id,
              balance
            )
            VALUES ($1, 0)

            ON CONFLICT (user_id)
            DO NOTHING
            `,
            [buyerId]
          );

          /* ==========================================
             REFUND BUYER
          ========================================== */

          await client.query(
            `
            UPDATE wallets
            SET
              balance = balance + $1,
              updated_at = NOW()
            WHERE user_id = $2
            `,
            [
              amount,
              buyerId,
            ]
          );

          /* ==========================================
             WALLET JOURNAL
          ========================================== */

          await client.query(
            `
            INSERT INTO wallet_journal (
              owner_id,
              owner_type,
              entry_type,
              direction,
              amount,
              currency,
              note,
              ref_id,
              ref_table
            )
            VALUES (
              $1,
              'BUYER',
              'BUYER_REFUND',
              'CREDIT',
              $2,
              'PI',
              'Return refund',
              $3,
              'returns'
            )
            `,
            [
              buyerId,
              amount,
              returnId,
            ]
          );

          /* ==========================================
             UPDATE RETURN
          ========================================== */

          const updateRes =
            await client.query(
              `
              UPDATE returns
              SET
                status = 'refunded',
                refunded_at = NOW(),
                received_at = NOW(),
                updated_at = NOW()
              WHERE id = $1
              `,
              [returnId]
            );

          return {
            success:
              updateRes.rowCount > 0,

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
          userId: result.sellerId!,
          type: "refund_completed",
          category: "wallet",
          title: "Hoàn tiền đã hoàn tất",
          message:
            "Bạn đã xác nhận nhận hàng trả và hoàn tiền cho người mua.",
          priority: "normal",
        });

        await sendNotification({
          userId: result.buyerId!,
          type: "refund_completed",
          category: "wallet",
          title: "Bạn đã nhận được tiền hoàn",
          message:
            "Tiền hoàn đã được chuyển vào ví của bạn.",
          priority: "high",
        });

      } catch (err) {

        console.error(
          "[NOTIFICATION][REFUND_COMPLETED]",
          err
        );

      }

    }

    return result.success;

  } catch (error) {

    console.error(
      "[RETURN][RECEIVED]",
      {
        message:
          error instanceof Error
            ? error.message
            : "UNKNOWN",
      }
    );

    throw error;
  }
}
