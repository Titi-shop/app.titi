"use client";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

type Props = {
  status: string;
  reviewed?: boolean;

  onDetail: () => void;
  onCancel?: () => void;
  onReceived?: () => void;
  onReview?: () => void;
};

export default function CustomerOrderActions({
  status,
  reviewed,
  onDetail,
  onCancel,
  onReceived,
  onReview,
}: Props) {
  const { t } = useTranslation();

  function btnStop(
    fn?: () => void
  ) {
    return (
      e: React.MouseEvent<HTMLButtonElement>
    ) => {
      e.preventDefault();
      e.stopPropagation();
      fn?.();
    };
  }

  return (
    <div
      className="flex gap-2 flex-wrap justify-end"
      onClick={(e) => e.stopPropagation()}
    >
      {/* DETAIL */}
      <button
        type="button"
        onClick={btnStop(onDetail)}
        className="px-3 py-1.5 rounded-lg border text-sm font-medium bg-white active:scale-95 transition"
      >
        {t.detail ?? "Detail"}
      </button>

      {/* PENDING */}
      {status === "pending" &&
        onCancel && (
          <button
            type="button"
            onClick={btnStop(onCancel)}
            className="px-3 py-1.5 rounded-lg border border-red-500 text-red-500 text-sm font-medium active:scale-95 transition"
          >
            {t.cancel_order ??
              "Cancel"}
          </button>
        )}

      {/* SHIPPING */}
      {status === "shipping" &&
        onReceived && (
          <button
            type="button"
            onClick={btnStop(
              onReceived
            )}
            className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium active:scale-95 transition"
          >
            {t.received ??
              "Received"}
          </button>
        )}

      {/* COMPLETED */}
      {status ===
        "completed" &&
        onReview &&
        !reviewed && (
          <button
            type="button"
            onClick={btnStop(onReview)}
            className="px-3 py-1.5 rounded-lg border border-orange-500 text-orange-500 text-sm font-medium active:scale-95 transition"
          >
            {t.review_orders ??
              "Review"}
          </button>
        )}

      {/* REVIEWED */}
      {status ===
        "completed" &&
        reviewed && (
          <button
            type="button"
            disabled
            className="px-3 py-1.5 rounded-lg bg-green-100 text-green-600 text-sm font-medium cursor-default"
          >
            {t.order_review ??
              "Reviewed"}
          </button>
        )}
    </div>
  );
}
