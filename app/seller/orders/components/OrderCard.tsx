"use client";

import Image from "next/image";

import { formatPi } from "@/lib/pi";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import type { Order } from "../types";

type Props = {
  order: Order;
  actions?: React.ReactNode;
  onClick?: () => void;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString();
}

export default function OrderCard({
  order,
  actions,
  onClick,
}: Props) {
  const { t } = useTranslation();

  return (
    <article
      onClick={onClick}
      className="
      overflow-hidden
      rounded-2xl
      border
      border-gray-200
      bg-white
      shadow-sm
      transition
      active:scale-[0.99]

      dark:border-zinc-800
      dark:bg-zinc-900
      "
    >
      {/* HEADER */}

      <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3 dark:border-zinc-800">

        <div>

          <h3 className="font-semibold">
            #{order.order_number}
          </h3>

          <p className="mt-1 text-xs text-gray-500">
            {formatDate(order.created_at)}
          </p>

        </div>

      <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-600 dark:bg-orange-900/40 dark:text-orange-300">
  {t[`order_${order.fulfillment_status}`] ??
    order.fulfillment_status}
</span>

      </div>

      {/* BUYER */}

      <div className="border-b border-gray-100 px-4 py-3 text-sm dark:border-zinc-800">

        <div className="font-medium">
          {order.shipping_name}
        </div>

        <div className="mt-1 text-xs text-gray-500">
          {order.shipping_phone}
        </div>

      </div>

      {/* ITEMS */}

      <div className="divide-y divide-gray-100 dark:divide-zinc-800">

        {order.order_items.map((item) => (

          <div
            key={item.id}
            className="flex gap-3 p-4"
          >
            <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-gray-100 dark:bg-zinc-800">

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

              <p className="mt-1 text-xs text-gray-500">

                x{item.quantity}

                {" · "}

                π{formatPi(item.unit_price)}

              </p>

            </div>

          </div>

        ))}

      </div>

      {/* FOOTER */}

      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">

        <div>

          <div className="text-xs text-gray-500">
            {order.total_quantity} {t.quantity ?? "Qty"}
          </div>

          <div className="font-semibold">

            {t.total ?? "Total"}

            {" : "}

            π{formatPi(order.total)}

          </div>

        </div>

        <div>

          {actions}

        </div>

      </div>

    </article>
  );
}
