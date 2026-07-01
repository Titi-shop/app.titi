// =========================================================
// lib/db/notifications.ts
// =========================================================

import { query } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

export type NotificationRow = {
  id: string;

  user_id: string;

  type: string;

  category: string;

  title: string;

  message: string;

  image_url: string | null;

  action_type: string | null;

  action_url: string | null;

  order_id: string | null;

  order_item_id: string | null;

  product_id: string | null;

  return_id: string | null;

  review_id: string | null;

  is_seen: boolean;

  seen_at: Date | null;

  is_read: boolean;

  read_at: Date | null;

  priority: string;

  is_pushed: boolean;

  pushed_at: Date | null;

  dedupe_key: string | null;

  extra_data: Record<string, unknown> | null;

  deleted_at: Date | null;

  created_at: Date;

  updated_at: Date;
};

export type CreateNotificationInput = {
  userId: string;

  type: string;

  category: string;

  title: string;

  message: string;

  imageUrl: string | null;

  actionType: string | null;

  actionUrl: string | null;

  orderId: string | null;

  orderItemId: string | null;

  productId: string | null;

  returnId: string | null;

  reviewId: string | null;

  priority: string;

  dedupeKey: string | null;

  extraData: Record<string, unknown> | null;
};

/* =========================================================
   CREATE NOTIFICATION
========================================================= */

export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationRow> {

  const result =
    await query<NotificationRow>(
      `
      INSERT INTO notifications
      (
        user_id,
        type,
        category,
        title,
        message,
        image_url,
        action_type,
        action_url,
        order_id,
        order_item_id,
        product_id,
        return_id,
        review_id,
        priority,
        dedupe_key,
        extra_data
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16
      )
      RETURNING *
      `,
      [
        input.userId,
        input.type,
        input.category,
        input.title,
        input.message,
        input.imageUrl,
        input.actionType,
        input.actionUrl,
        input.orderId,
        input.orderItemId,
        input.productId,
        input.returnId,
        input.reviewId,
        input.priority,
        input.dedupeKey,
        input.extraData,
      ]
    );

  return result.rows[0];

}
/* =========================================================
   GET USER NOTIFICATIONS
========================================================= */

export async function getNotificationsByUserId(
  userId: string
): Promise<NotificationRow[]> {

  const result =
    await query<NotificationRow>(
      `
      SELECT *
      FROM notifications
      WHERE
        user_id = $1
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [userId]
    );

  return result.rows;

}
