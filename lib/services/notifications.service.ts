// =========================================================
// lib/services/notifications.service.ts
// =========================================================

import {
  createNotification,
} from "@/lib/db/notifications";

export type CreateNotificationInput = {
  userId: string;

  type: string;

  category?: string;

  title: string;

  message: string;

  imageUrl?: string | null;

  actionType?: string | null;

  actionUrl?: string | null;

  orderId?: string | null;

  orderItemId?: string | null;

  productId?: string | null;

  returnId?: string | null;

  reviewId?: string | null;

  priority?: "low" | "normal" | "high" | "urgent";

  dedupeKey?: string | null;

  extraData?: Record<string, unknown> | null;
};

export async function sendNotification(
  input: CreateNotificationInput
): Promise<void> {

  await createNotification({
    userId: input.userId,

    type: input.type,

    category:
      input.category ??
      "general",

    title: input.title,

    message: input.message,

    imageUrl:
      input.imageUrl ?? null,

    actionType:
      input.actionType ?? null,

    actionUrl:
      input.actionUrl ?? null,

    orderId:
      input.orderId ?? null,

    orderItemId:
      input.orderItemId ?? null,

    productId:
      input.productId ?? null,

    returnId:
      input.returnId ?? null,

    reviewId:
      input.reviewId ?? null,

    priority:
      input.priority ??
      "normal",

    dedupeKey:
      input.dedupeKey ?? null,

    extraData:
      input.extraData ?? null,
  });

}
