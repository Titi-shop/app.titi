"use client";

import type { MouseEvent } from "react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import type {
  OrderStatus,
} from "../types";

/* =========================================================
   PROPS
========================================================= */

type Props = {
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

  function stop(
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

  const btn =
    "rounded-xl px-3 py-2 text-xs font-medium transition active:scale-95 disabled:opacity-50";

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
          onClick={stop(onDetail)}
          disabled={loading}
          className={`${btn}
            border
            border-gray-300
            bg-white
            text-gray-700

            dark:border-zinc-700
            dark:bg-zinc-900
            dark:text-zinc-200`}
        >
          {t.detail ?? "Detail"}
        </button>
      )}

      {/* PENDING */}

      {(status === "pending" ||
        status ===
          "pending_fulfillment") && (
        <>
          {onConfirm && (
            <button
              type="button"
              onClick={stop(
                onConfirm
              )}
              disabled={loading}
              className={`${btn}
                bg-orange-500
                text-white`}
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
              onClick={stop(
                onCancel
              )}
              disabled={loading}
              className={`${btn}
                border
                border-red-500
                text-red-500`}
            >
              {t.cancel ??
                "Cancel"}
            </button>
          )}
        </>
      )}

      {/* PROCESSING */}

      {status ===
        "processing" &&
        onShipping && (
          <button
            type="button"
            onClick={stop(
              onShipping
            )}
            disabled={loading}
            className={`${btn}
              bg-blue-600
              text-white`}
          >
            {loading
              ? "..."
              : t.start_shipping ??
                "Start shipping"}
          </button>
        )}

      {/* SHIPPED */}

      {status ===
        "shipped" && (
        <Badge>
          {t.order_shipping ??
            "Shipping"}
        </Badge>
      )}

      {/* DELIVERED */}

      {status ===
        "delivered" && (
        <Badge>
          {t.order_delivered ??
            "Delivered"}
        </Badge>
      )}

      {/* COMPLETED */}

      {status ===
        "completed" && (
        <Badge>
          {t.order_completed ??
            "Completed"}
        </Badge>
      )}

      {/* CANCELLED */}

      {status ===
        "cancelled" && (
        <Badge danger>
          {t.order_cancelled ??
            "Cancelled"}
        </Badge>
      )}
    </div>
  );
}

/* =========================================================
   BADGE
========================================================= */

function Badge({
  children,
  danger = false,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <span
      className={`rounded-xl px-3 py-2 text-xs font-medium

      ${
        danger
          ? `
          bg-red-100
          text-red-600

          dark:bg-red-950
          dark:text-red-300
          `
          : `
          bg-green-100
          text-green-700

          dark:bg-green-950
          dark:text-green-300
          `
      }`}
    >
      {children}
    </span>
  );
}
