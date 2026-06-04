"use client";

import type { MouseEvent } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { ORDER_STATUS, type OrderStatus } from "@/constants/order-status";

type Props = {
  status: OrderStatus;
  reviewed?: boolean;

  onDetail: () => void;
  onCancel?: () => void;
  onReceived?: () => void;
  onReview?: () => void;
};

function stop(fn?: () => void) {
  return (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    fn?.();
  };
}

export default function CustomerOrderActions({
  status,
  reviewed = false,
  onDetail,
  onCancel,
  onReceived,
  onReview,
}: Props) {
  const { t } = useTranslation();

  const base =
    "px-3 py-2 rounded-xl text-sm font-medium transition active:scale-95";

  const isPending = status === ORDER_STATUS.PENDING;
  const isPendingFulfillment =
    status === ORDER_STATUS.PENDING_FULFILLMENT;
  const isProcessing = status === ORDER_STATUS.PROCESSING;
  const isShipped = status === ORDER_STATUS.SHIPPED;
  const isDelivered = status === ORDER_STATUS.DELIVERED;
  const isCompleted = status === ORDER_STATUS.COMPLETED;
  const isCancelled = status === ORDER_STATUS.CANCELLED;

  return (
    <div
      className="flex flex-wrap justify-end gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {/* DETAIL */}
      <button
        onClick={stop(onDetail)}
        className={`${base} border bg-white text-gray-700`}
      >
        {t.detail ?? "Detail"}
      </button>

      {/* CANCEL */}
{(isPending || isPendingFulfillment) && onCancel && (
  <button
    onClick={stop(onCancel)}
    className={`${base} border border-red-500 text-red-500`}
  >
    {t.cancel_order ?? "Cancel"}
  </button>
)}

{/* PROCESSING */}
{isProcessing && (
  <span className={`${base} bg-blue-50 text-blue-600`}>
    {t.processing ?? "Processing"}
  </span>
)}

      {/* 🚨 SHIPPED = NHẬN HÀNG */}
      {isShipped && onReceived && (
        <button
          onClick={stop(onReceived)}
          className={`${base} bg-green-600 text-white`}
        >
          {t.received ?? "Received"}
        </button>
      )}

      {/* DELIVERED = REVIEW */}
      {isDelivered && !reviewed && onReview && (
        <button
          onClick={stop(onReview)}
          className={`${base} border border-orange-500 text-orange-500`}
        >
          {t.review_orders ?? "Review"}
        </button>
      )}

      {/* REVIEWED */}
      {isDelivered && reviewed && (
        <span className={`${base} bg-green-100 text-green-600`}>
          {t.order_reviewed ?? "Reviewed"}
        </span>
      )}

      {/* COMPLETED */}
      {isCompleted && (
  <span className={`${base} bg-gray-100 text-gray-600`}>
    Completed
  </span>
)}
    </div>
  );
          }
