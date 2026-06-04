"use client";

import type { MouseEvent } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import {
  ORDER_STATUS,
  type OrderStatus,
} from "@/constants/order-status";

/* =======================================================
   TYPES
======================================================= */

type Props = {
  status: OrderStatus;

  reviewed?: boolean;

  onDetail: () => void;
  onCancel?: () => void;
  onReceived?: () => void;
  onReview?: () => void;
};

/* =======================================================
   HELPERS
======================================================= */

function stopClick(fn?: () => void) {
  return (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    fn?.();
  };
}

/* =======================================================
   COMPONENT
======================================================= */

export default function CustomerOrderActions({
  status,
  reviewed = false,
  onDetail,
  onCancel,
  onReceived,
  onReview,
}: Props) {
  const { t } = useTranslation();

  const baseBtn =
    "px-3 py-2 rounded-xl text-sm font-medium transition active:scale-95";

  const isPending = status === ORDER_STATUS.PENDING;
  const isPendingFulfillment =
    status === ORDER_STATUS.PENDING_FULFILLMENT;
  const isProcessing = status === ORDER_STATUS.PROCESSING;
  const isShipped = status === ORDER_STATUS.SHIPPED;
  const isDelivered = status === ORDER_STATUS.DELIVERED;
  const isCompleted = status === ORDER_STATUS.COMPLETED;
  const isCancelled = status === ORDER_STATUS.CANCELLED;
  const isRefunded = status === ORDER_STATUS.REFUNDED;

  return (
    <div
      className="flex flex-wrap justify-end gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {/* DETAIL */}
      <button
        type="button"
        onClick={stopClick(onDetail)}
        className={`${baseBtn} border border-gray-300 bg-white text-gray-700`}
      >
        {t.detail ?? "Detail"}
      </button>

      {/* PENDING (chưa thanh toán) */}
      {isPending && onCancel && (
        <button
          type="button"
          onClick={stopClick(onCancel)}
          className={`${baseBtn} border border-red-500 text-red-500 bg-white`}
        >
          {t.cancel_order ?? "Cancel"}
        </button>
      )}

      {/* PENDING_FULFILLMENT / PROCESSING / SHIPPED */}
      {(isPendingFulfillment || isProcessing || isShipped) && (
        <span
          className={`${baseBtn} bg-blue-50 text-blue-600 cursor-default`}
        >
          {isPendingFulfillment
            ? t.order_waiting ?? "Waiting seller"
            : isProcessing
            ? t.order_processing ?? "Processing"
            : t.order_shipping ?? "Shipping"}
        </span>
      )}

      {/* DELIVERED → buyer confirm received */}
      {isDelivered && onReceived && (
        <button
          type="button"
          onClick={stopClick(onReceived)}
          className={`${baseBtn} bg-green-600 text-white`}
        >
          {t.received ?? "Received"}
        </button>
      )}

      {/* COMPLETED → review */}
      {isCompleted && !reviewed && onReview && (
        <button
          type="button"
          onClick={stopClick(onReview)}
          className={`${baseBtn} border border-orange-500 text-orange-500 bg-white`}
        >
          {t.review_orders ?? "Review"}
        </button>
      )}

      {/* REVIEWED */}
      {isCompleted && reviewed && (
        <span
          className={`${baseBtn} bg-green-100 text-green-600 cursor-default`}
        >
          {t.order_reviewed ?? "Reviewed"}
        </span>
      )}

      {/* CANCELLED */}
      {isCancelled && (
        <span
          className={`${baseBtn} bg-red-50 text-red-500 cursor-default`}
        >
          {t.order_cancelled ?? "Cancelled"}
        </span>
      )}

      {/* REFUNDED */}
      {isRefunded && (
        <span
          className={`${baseBtn} bg-gray-100 text-gray-500 cursor-default`}
        >
          {t.order_refunded ?? "Refunded"}
        </span>
      )}
    </div>
  );
}
