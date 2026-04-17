"use client";

import { formatPi } from "@/lib/pi";
import CustomerOrderActions from "./CustomerOrderActions";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* =======================================================
   TYPES
======================================================= */

type OrderItem = {
  id?: string;
  product_id?: string;
  product_name?: string;
  thumbnail?: string | null;
  images?: string[] | null;
  quantity?: number;
  unit_price?: number;
  seller_message?: string | null;
  seller_cancel_reason?: string | null;
};

type Order = {
  id: string;
  order_number?: string | null;
  status: string;
  total?: number;
  order_items?: OrderItem[];
};

type Props = {
  order: Order;

  onDetail: () => void;
  onCancel?: () => void;
  onReceived?: () => void;
  onBuyAgain?: () => void;
  onReview?: () => void;

  reviewed?: boolean;
};

/* =======================================================
   COMPONENT
======================================================= */

export default function CustomerOrderCard({
  order,
  onDetail,
  onCancel,
  onReceived,
  onBuyAgain,
  onReview,
  reviewed = false,
}: Props) {
  const { t } = useTranslation();

  const items =
    order.order_items ?? [];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 border-b bg-gray-50 px-4 py-3 text-sm">
        <span className="truncate font-semibold text-gray-800">
          #
          {order.order_number ??
            order.id.slice(
              0,
              8
            )}
        </span>

        <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-600">
          {t[
            `order_${order.status}`
          ] ??
            order.status}
        </span>
      </div>

      {/* ITEMS */}
      <div className="divide-y divide-gray-100">
        {items.map(
          (
            item,
            index
          ) => {
            const image =
              item.thumbnail ||
              item.images?.[0] ||
              "/placeholder.png";

            return (
              <div
                key={
                  item.id ??
                  `${order.id}-${index}`
                }
                className="flex gap-3 px-4 py-4"
              >
                {/* IMAGE */}
                <img
                  src={image}
                  alt={
                    item.product_name ??
                    "Product"
                  }
                  loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-xl bg-gray-100 object-cover"
                />

                {/* INFO */}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-gray-800">
                    {item.product_name ??
                      "Product"}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    x
                    {item.quantity ??
                      0}{" "}
                    · π
                    {formatPi(
                      Number(
                        item.unit_price ??
                          0
                      )
                    )}
                  </p>

                  {item.seller_message && (
                    <p className="mt-1 line-clamp-2 text-xs text-green-600">
                      💌{" "}
                      {
                        item.seller_message
                      }
                    </p>
                  )}

                  {order.status ===
                    "cancelled" &&
                    item.seller_cancel_reason && (
                      <p className="mt-1 line-clamp-2 text-xs text-red-500">
                        {
                          item.seller_cancel_reason
                        }
                      </p>
                    )}
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* FOOTER */}
      <div
        className="flex flex-col gap-3 border-t bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        <span className="text-sm text-gray-700">
          {t.total ??
            "Total"}
          :{" "}
          <b className="text-gray-900">
            π
            {formatPi(
              Number(
                order.total ??
                  0
              )
            )}
          </b>
        </span>

        <CustomerOrderActions
          status={
            order.status
          }
          reviewed={
            reviewed
          }
          onDetail={
            onDetail
          }
          onCancel={
            onCancel
          }
          onReceived={
            onReceived
          }
          onBuyAgain={
            onBuyAgain
          }
          onReview={
            onReview
          }
        />
      </div>
    </div>
  );
}
