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
border-[var(--border-color)]
bg-[var(--card-bg)]
shadow-sm
transition
active:scale-[0.99]
"
    >
      {/* HEADER */}

      <div className="flex items-start justify-between border-b border-[var(--border-color)] px-4 py-3">

        <div>

          <h3 className="font-semibold">
            #{order.order_number}
          </h3>

          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {formatDate(order.created_at)}
          </p>

        </div>

      <span className="
rounded-full
bg-[color:color-mix(in_srgb,var(--color-primary)_12%,transparent)]
px-3
py-1
text-xs
font-medium
text-[var(--color-primary)]
">
  {t[`order_${order.fulfillment_status}`] ??
    order.fulfillment_status}
</span>

      </div>

      {/* BUYER */}

      <div className="border-b border-[var(--border-color)] px-4 py-3 text-sm">

        <div className="font-medium">
          {order.shipping_name}
        </div>

        <div className="mt-1 text-xs text-[var(--text-muted)]">
          {order.shipping_phone}
        </div>

      </div>

      {/* ITEMS */}

      <div className="divide-y divide-[var(--border-color)]">
        {order.order_items.map((item) => (

          <div
            key={item.id}
            className="flex gap-3 p-4"
          >
            <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-[var(--surface-2)]">

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

              <p className="mt-1 text-xs text-[var(--text-muted)]">

                x{item.quantity}

                {" · "}

                π{formatPi(item.unit_price)}

              </p>

            </div>

          </div>

        ))}

      </div>

      {/* FOOTER */}

      <div className="
flex
items-center
justify-between
border-t
border-[var(--border-color)]
bg-[var(--card-secondary)]
px-4
py-3
">

        <div>

          <div className="text-xs text-[var(--text-muted)]">
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
