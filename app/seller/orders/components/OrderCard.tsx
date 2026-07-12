"use client";

import Image from "next/image";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";

import type { Order } from "../types";

type Props = {
  order: Order;
  onClick?: () => void;
  actions?: React.ReactNode;
};

/* =========================================================
   HELPERS
========================================================= */

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function statusColor(status: Order["fulfillment_status"]) {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-700";

    case "pending_fulfillment":
      return "bg-orange-100 text-orange-700";

    case "processing":
      return "bg-blue-100 text-blue-700";

    case "shipped":
      return "bg-indigo-100 text-indigo-700";

    case "delivered":
      return "bg-cyan-100 text-cyan-700";

    case "completed":
      return "bg-green-100 text-green-700";

    case "cancelled":
      return "bg-red-100 text-red-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export default function OrderCard({
  order,
  onClick,
  actions,
}: Props) {
  const { t } = useTranslation();

  const items = order.order_items ?? [];

  const totalQty =
    order.total_quantity ??
    items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

  return (
    <article
      onClick={onClick}
      className="
        overflow-hidden
        rounded-2xl
        border
        bg-white
        shadow-sm
        transition
        active:scale-[0.99]
        dark:border-zinc-800
        dark:bg-zinc-900
      "
    >
      {/* HEADER */}

      <div className="flex items-start justify-between gap-3 border-b bg-gray-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">

        <div className="min-w-0">

          <p className="truncate text-sm font-semibold">
            #{order.order_number}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {formatDate(order.created_at)}
          </p>

        </div>

        <span
          className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusColor(
            order.fulfillment_status
          )}`}
        >
          {order.fulfillment_status}
        </span>

      </div>

      {/* CUSTOMER */}

      <div className="border-b px-4 py-3 dark:border-zinc-800">

        <p className="font-medium">
          {order.shipping_name}
        </p>

        <p className="mt-1 text-sm text-gray-500">
          {order.shipping_phone}
        </p>

      </div>

      {/* PRODUCTS */}

      <div className="divide-y dark:divide-zinc-800">

        {items.map((item) => (

          <div
            key={item.id}
            className="flex gap-3 p-4"
          >

            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">

              <Image
                src={
                  item.thumbnail ||
                  "/placeholder.png"
                }
                alt={item.product_name}
                fill
                sizes="64px"
                className="object-cover"
              />

            </div>

            <div className="min-w-0 flex-1">

              <p className="line-clamp-2 text-sm font-medium">
                {item.product_name}
              </p>

              {item.variant_value && (

                <p className="mt-1 text-xs text-gray-500">
                  {item.variant_name}:{" "}
                  {item.variant_value}
                </p>

              )}

              <p className="mt-1 text-xs text-gray-500">
                x{item.quantity}
                {" • "}
                π{formatPi(item.unit_price)}
              </p>

            </div>

          </div>

        ))}

      </div>

      {/* FOOTER */}

      <div
        className="flex flex-col gap-3 border-t bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >

        <div>

          <p className="text-xs text-gray-500">
            {totalQty} {t.quantity ?? "qty"}
          </p>

          <p className="font-semibold">
            {t.total ?? "Total"} : π
            {formatPi(order.total)}
          </p>

        </div>

        <div className="flex justify-end">
          {actions}
        </div>

      </div>

    </article>
  );
}
