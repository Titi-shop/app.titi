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
          className={`${baseButton} border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] hover:bg-[var(--surface-2)]`}
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
              className={`${baseButton} bg-[var(--color-primary)] text-white hover:opacity-90`}
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
              className={`${baseButton} border border-[var(--color-danger)] bg-[var(--card-bg)] text-[var(--color-danger)] hover:bg-[color:color-mix(in_srgb,var(--color-danger)_10%,transparent)]`}
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
            className={`${baseButton} bg-[var(--color-info)] text-white hover:opacity-90`}
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
        <span className="
rounded-xl
px-3
py-2
text-xs
font-medium
bg-[color:color-mix(in_srgb,var(--color-info)_12%,transparent)]
text-[var(--color-info)]
">
          {t.order_shipping ??
            "Shipping"}
        </span>
      )}

      {/* DELIVERED */}

      {status === "delivered" && (
        <span className="
rounded-xl
px-3
py-2
text-xs
font-medium
bg-[color:color-mix(in_srgb,var(--color-info)_12%,transparent)]
text-[var(--color-info)]
">
          {t.order_delivered ??
            "Delivered"}
        </span>
      )}

      {/* COMPLETED */}

      {status === "completed" && (
        <span className="
rounded-xl
px-3
py-2
text-xs
font-medium
bg-[color:color-mix(in_srgb,var(--color-success)_12%,transparent)]
text-[var(--color-success)]
">
          {t.order_completed ??
            "Completed"}
        </span>
      )}

      {/* CANCELLED */}

      {status === "cancelled" && (
        <span className="
rounded-xl
px-3
py-2
text-xs
font-medium
bg-[color:color-mix(in_srgb,var(--color-danger)_12%,transparent)]
text-[var(--color-danger)]
">
          {t.order_cancelled ??
            "Cancelled"}
        </span>
      )}
    </div>
  );
}
