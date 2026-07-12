"use client";

import { MouseEvent } from "react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import type { OrderStatus } from "../types";

type Props = {
  orderId: string;

  status: OrderStatus;

  loading?: boolean;

  onDetail?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onShipping?: () => void;
};

/* =========================================================
   COMPONENT
========================================================= */

export default function OrderActions({
  status,
  loading = false,

  onDetail,
  onConfirm,
  onCancel,
  onShipping,
}: Props) {
  const { t } = useTranslation();

  /* =========================================================
     SAFE CLICK
  ========================================================= */

  function stopClick(
    callback?: () => void
  ) {
    return (
      e: MouseEvent<HTMLButtonElement>
    ) => {
      e.preventDefault();
      e.stopPropagation();

      if (loading) return;

      callback?.();
    };
  }

  /* =========================================================
     BUTTON
  ========================================================= */

  const baseButton =
    "rounded-xl px-3 py-2 text-xs font-medium transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div
      className="flex flex-wrap justify-end gap-2"
      onClick={(e) =>
        e.stopPropagation()
      }
    >
      {/* DETAIL */}

      {onDetail && (
        <button
          type="button"
          disabled={loading}
          onClick={stopClick(
            onDetail
          )}
          className={`${baseButton} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200`}
        >
          {t.detail ?? "Detail"}
        </button>
      )}

      {/* PENDING */}

      {status === "pending" && (
        <>
          {onConfirm && (
            <button
              type="button"
              disabled={loading}
              onClick={stopClick(
                onConfirm
              )}
              className={`${baseButton} bg-orange-500 text-white hover:bg-orange-600`}
            >
              {loading
                ? "..."
                : t.confirm ??
                  "Confirm"}
            </button>
          )}

          {onCancel && (
            <button
              type="button"
              disabled={loading}
              onClick={stopClick(
                onCancel
              )}
              className={`${baseButton} border border-red-500 bg-white text-red-600 hover:bg-red-50 dark:bg-zinc-900`}
            >
              {t.cancel ??
                "Cancel"}
            </button>
          )}
        </>
      )}

      {/* PENDING FULFILLMENT */}

      {status ===
        "pending_fulfillment" &&
        onConfirm && (
          <button
            type="button"
            disabled={loading}
            onClick={stopClick(
              onConfirm
            )}
            className={`${baseButton} bg-orange-500 text-white hover:bg-orange-600`}
          >
            {loading
              ? "..."
              : t.confirm ??
                "Confirm"}
          </button>
        )}

      {/* PROCESSING */}

      {status ===
        "processing" &&
        onShipping && (
          <button
            type="button"
            disabled={loading}
            onClick={stopClick(
              onShipping
            )}
            className={`${baseButton} bg-blue-600 text-white hover:bg-blue-700`}
          >
            {loading
              ? "..."
              : t.start_shipping ??
                "Start shipping"}
          </button>
        )}

      {/* SHIPPED */}

      {status === "shipped" && (
        <span className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
          {t.order_shipping ??
            "Shipping"}
        </span>
      )}

      {/* DELIVERED */}

      {status === "delivered" && (
        <span className="rounded-xl bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-300">
          {t.order_delivered ??
            "Delivered"}
        </span>
      )}

      {/* COMPLETED */}

      {status === "completed" && (
        <span className="rounded-xl bg-green-50 px-3 py-2 text-xs font-medium text-green-600 dark:bg-green-900/20 dark:text-green-300">
          {t.order_completed ??
            "Completed"}
        </span>
      )}

      {/* CANCELLED */}

      {status === "cancelled" && (
        <span className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-300">
          {t.order_cancelled ??
            "Cancelled"}
        </span>
      )}
    </div>
  );
}
