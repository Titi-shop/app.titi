"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import useSWR from "swr";
import { useMemo } from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";

import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { formatPi } from "@/lib/pi";

import {
  useAuth,
} from "@/context/AuthContext";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

import type {
  Order,
  OrderResponse,
  ReturnStatus,
  PaymentStatus,
} from "@/types/orders";

import type {
  OrderStatus,
} from "@/constants/order-status";

/* =====================================================
   FETCHER
===================================================== */

async function fetchOrder(
  url: string
): Promise<Order | null> {
  try {
    const res =
      await apiAuthFetch(url, {
        cache: "no-store",
      });

    if (!res.ok) {
      return null;
    }

    const json =
      (await res.json()) as OrderResponse;

    return json.order ?? null;

  } catch (err) {

    console.error(
      "[ORDER_DETAIL_FETCH]",
      err
    );

    return null;
  }
}

/* =====================================================
   STATUS COLORS
===================================================== */

function getStatusClass(
  status:
    | OrderStatus
    | ReturnStatus
    | PaymentStatus
    | string
) {
  switch (status) {
    case "pending":
    case "pending_fulfillment":
      return "bg-yellow-100 text-yellow-700";

    case "processing":
      return "bg-blue-100 text-blue-700";

    case "shipping":
    case "shipped":
      return "bg-indigo-100 text-indigo-700";

    case "delivered":
      return "bg-cyan-100 text-cyan-700";

    case "completed":
    case "paid":
    case "approved":
      return "bg-green-100 text-green-700";

    case "cancelled":
    case "failed":
    case "rejected":
      return "bg-red-100 text-red-700";

    case "refunded":
      return "bg-purple-100 text-purple-700";

    case "shipping_back":
      return "bg-orange-100 text-orange-700";

    case "received":
      return "bg-teal-100 text-teal-700";

    default:
      return "bg-gray-100 text-gray-600";
  }
}

/* =====================================================
   STATUS LABEL
===================================================== */

function getStatusLabel(
  t: Record<string, string>,
  order: Order
) {
  if (order.return_status) {
    return (
      t[
        `return_${order.return_status}`
      ] ??
      order.return_status
    );
  }

  return (
    t[
      `order_${order.fulfillment_status}`
    ] ??
    order.fulfillment_status
  );
}

/* =====================================================
   DATE FORMAT
===================================================== */

function formatDate(
  value?: string | null
) {
  if (!value) return "-";

  return new Date(
    value
  ).toLocaleString();
}

/* =====================================================
   TIMELINE
===================================================== */

type TimelineItem = {
  key: string;

  label: string;

  date: string | null;
};

function buildTimeline(
  t: Record<string, string>,
  order: Order
): TimelineItem[] {

  const list: TimelineItem[] = [];

  list.push({
    key: "created",
    label:
      t.order_created ??
      "Order created",
    date:
      order.created_at,
  });

  if (
    order.processing_at
  ) {
    list.push({
      key: "processing",
      label:
        t.order_processing ??
        "Processing",
      date:
        order.processing_at,
    });
  }

  if (
    order.shipped_at
  ) {
    list.push({
      key: "shipping",
      label:
        t.order_shipping ??
        "Shipping",
      date:
        order.shipped_at,
    });
  }

  if (
    order.delivered_at
  ) {
    list.push({
      key: "delivered",
      label:
        t.order_delivered ??
        "Delivered",
      date:
        order.delivered_at,
    });
  }

  if (
    order.completed_at
  ) {
    list.push({
      key: "completed",
      label:
        t.order_completed ??
        "Completed",
      date:
        order.completed_at,
    });
  }

  if (
    order.cancelled_at
  ) {
    list.push({
      key: "cancelled",
      label:
        t.order_cancelled ??
        "Cancelled",
      date:
        order.cancelled_at,
    });
  }

  return list;
}
export default function OrderDetailPage() {
  const { t } = useTranslation();

  const router = useRouter();

  const params = useParams();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const orderId =
    typeof params.id === "string"
      ? params.id
      : "";

  const {
    data: order,
    isLoading,
    mutate,
  } = useSWR<Order | null>(
    user && orderId
      ? `/api/orders/${orderId}`
      : null,
    fetchOrder
  );

  const timeline = useMemo(() => {
    if (!order) return [];

    return buildTimeline(
      t as Record<string, string>,
      order
    );
  }, [order, t]);

  if (authLoading || isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted">
          {t.loading_order ??
            "Loading order..."}
        </p>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-500">
          {t.order_not_found ??
            "Order not found"}
        </p>

        <button
          onClick={() =>
            mutate()
          }
          className="btn-primary"
        >
          {t.retry ?? "Retry"}
        </button>
      </main>
    );
  }

  const hasReturn =
    !!order.return_status &&
    order.return_status !==
      "rejected";

  const canReturn =
    order.fulfillment_status ===
      "delivered" && !hasReturn;

  return (
    <main className="min-h-screen bg-[var(--background)] pb-24">

      <div className="border-b border-black/5 bg-card p-4">

        <button
          onClick={() =>
            router.back()
          }
          className="mb-4 text-sm text-muted"
        >
          ← {t.back ?? "Back"}
        </button>

        <div className="flex justify-between gap-4">

          <div>

            <h1 className="font-bold text-lg">
              #
              {order.order_number}
            </h1>

            <p className="text-xs text-muted mt-1">
              {formatDate(
                order.created_at
              )}
            </p>

          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
              order.return_status ??
                order.fulfillment_status
            )}`}
          >
            {getStatusLabel(
              t as Record<
                string,
                string
              >,
              order
            )}
          </span>

        </div>

      </div>

      <section className="bg-card mt-3 p-4">

        <h2 className="font-semibold mb-3">
          {t.order_timeline ??
            "Timeline"}
        </h2>

        <div className="space-y-3">

          {timeline.map((item) => (
            <div
              key={item.key}
              className="flex gap-3"
            >

              <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />

              <div>

                <p className="text-sm font-medium">
                  {item.label}
                </p>

                <p className="text-xs text-muted">
                  {formatDate(
                    item.date
                  )}
                </p>

              </div>

            </div>
          ))}

        </div>

      </section>

      <section className="bg-card mt-3 p-4">

        <div className="flex justify-between py-1">
          <span>
            {t.subtotal ??
              "Subtotal"}
          </span>

          <span>
            π
            {formatPi(
              Number(
                order.subtotal
              )
            )}
          </span>
        </div>

        <div className="flex justify-between py-1">
          <span>
            {t.shipping_fee ??
              "Shipping"}
          </span>

          <span>
            π
            {formatPi(
              Number(
                order.shipping_fee
              )
            )}
          </span>
        </div>

        <div className="flex justify-between py-1">
          <span>
            {t.discount ??
              "Discount"}
          </span>

          <span>
            -π
            {formatPi(
              Number(
                order.discount
              )
            )}
          </span>
        </div>

        <div className="mt-3 border-t pt-3 flex justify-between font-bold">

          <span>
            {t.total ??
              "Total"}
          </span>

          <span>
            π
            {formatPi(
              Number(
                order.total
              )
            )}
          </span>

        </div>

      </section>
             <section className="bg-card mt-3 p-4">

        <h2 className="font-semibold mb-3">
          {t.shipping_address ??
            "Shipping Address"}
        </h2>

        <div className="space-y-1 text-sm">

          <p className="font-medium">
            {order.shipping_name}
          </p>

          <p>
            {order.shipping_phone}
          </p>

          <p>
            {[
              order.shipping_address_line,
              order.shipping_ward,
              order.shipping_district,
              order.shipping_region,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>

          <p>
            {[
              order.shipping_country,
              order.shipping_postal_code,
            ]
              .filter(Boolean)
              .join(" ")}
          </p>

        </div>

      </section>

      {(order.pi_payment_id ||
        order.pi_txid) && (
        <section className="bg-card mt-3 p-4">

          <h2 className="font-semibold mb-3">
            Pi Payment
          </h2>

          {order.pi_payment_id && (
            <div className="mb-2">

              <p className="text-xs text-muted">
                Payment ID
              </p>

              <p className="break-all text-sm">
                {order.pi_payment_id}
              </p>

            </div>
          )}

          {order.pi_txid && (
            <div>

              <p className="text-xs text-muted">
                Transaction ID
              </p>

              <p className="break-all text-sm">
                {order.pi_txid}
              </p>

            </div>
          )}

        </section>
      )}

      <section className="bg-card mt-3">

        {order.order_items.map(
          (item) => (

            <div
              key={item.id}
              className="flex gap-3 border-b border-black/5 p-4"
            >

              <Image
                src={
                  item.thumbnail ||
                  "/placeholder.png"
                }
                alt={
                  item.product_name ??
                  ""
                }
                width={84}
                height={84}
                className="rounded-xl object-cover"
              />

              <div className="flex-1">

                <p className="font-medium text-sm">
                  {item.product_name}
                </p>

                {item.variant_name && (
                  <p className="mt-1 text-xs text-muted">
                    {item.variant_name}
                    {item.variant_value
                      ? ` : ${item.variant_value}`
                      : ""}
                  </p>
                )}

                <div className="mt-2 flex justify-between text-sm">

                  <span>
                    ×
                    {item.quantity}
                  </span>

                  <span className="font-semibold">
                    π
                    {formatPi(
                      Number(
                        item.total_price
                      )
                    )}
                  </span>

                </div>

              </div>

            </div>

          )
        )}

      </section>

      {order.buyer_note && (
        <section className="bg-card mt-3 p-4">

          <h2 className="font-semibold mb-2">
            {t.buyer_note ??
              "Buyer Note"}
          </h2>

          <p className="text-sm whitespace-pre-wrap">
            {order.buyer_note}
          </p>

        </section>
      )}

      {hasReturn && (
        <section className="bg-card mt-3 p-4">

          <div className="flex items-center justify-between">

            <span>
              {t.return_status ??
                "Return Status"}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs ${getStatusClass(
                order.return_status!
              )}`}
            >
              {t[
                `return_${order.return_status}`
              ] ??
                order.return_status}
            </span>

          </div>

        </section>
      )}
             <div className="px-4 pt-4 space-y-3">

        {order.fulfillment_status ===
          "shipping" && (
          <button
            onClick={() =>
              router.push(
                `/customer/orders/${order.id}/confirm`
              )
            }
            className="btn-primary w-full"
          >
            {t.confirm_received ??
              "Confirm Received"}
          </button>
        )}

        {canReturn && (
          <button
            onClick={() =>
              router.push(
                `/customer/orders/${order.id}/return`
              )
            }
            className="btn-primary w-full"
          >
            ↩{" "}
            {t.request_return ??
              "Request Return"}
          </button>
        )}

        {order.order_items.length >
          0 && (
          <button
            onClick={() => {

              const pid =
                order.order_items[0]
                  ?.product_id;

              if (!pid) return;

              router.push(
                `/product/${pid}`
              );

            }}
            className="w-full rounded-xl border border-black/10 bg-card py-3 font-semibold"
          >
            {t.buy_again ??
              "Buy Again"}
          </button>
        )}

        <button
          onClick={() => mutate()}
          className="w-full rounded-xl border border-black/10 py-3"
        >
          {t.refresh ??
            "Refresh"}
        </button>

      </div>

    </main>
  );
}
