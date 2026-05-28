"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import Image from "next/image";
import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  ArrowLeft,
  PackageCheck,
  Truck,
  CircleX,
  Clock3,
  BadgeCheck,
  MapPin,
  Phone,
  User,
  RefreshCcw,
  ShoppingBag,
  ChevronRight,
  CreditCard,
  ClipboardList,
} from "lucide-react";

import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* ======================================================
   TYPES
====================================================== */

type FulfillmentStatus =
  | "pending"
  | "processing"
  | "shipping"
  | "delivered"
  | "cancelled";

type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  thumbnail: string;

  variant_name?: string | null;
  variant_value?: string | null;

  quantity: number;
  unit_price: number;
  total_price: number;

  status: FulfillmentStatus;
}

interface Order {
  id: string;
  order_number: string;

  fulfillment_status: FulfillmentStatus;
  payment_status: PaymentStatus;

  total: number;
  created_at: string;

  processing_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;

  shipping_name: string;
  shipping_phone: string;
  shipping_address_line: string;

  shipping_ward?: string | null;
  shipping_district?: string | null;
  shipping_region?: string | null;
  shipping_country?: string | null;
  shipping_postal_code?: string | null;

  order_items: OrderItem[];
}

/* ======================================================
   FETCHER
====================================================== */

const fetcher = async (
  url: string
): Promise<Order | null> => {
  try {
    const token = await getPiAccessToken();

    if (!token) return null;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data: unknown = await res.json();

    if (
      typeof data !== "object" ||
      data === null
    ) {
      return null;
    }

    const order = data as Record<string, unknown>;

    const rawItems = Array.isArray(
      order.order_items
    )
      ? order.order_items
      : [];

    const items: OrderItem[] = rawItems
      .filter(
        (
          item
        ): item is Record<string, unknown> =>
          typeof item === "object" &&
          item !== null
      )
      .map((item) => ({
        id:
          typeof item.id === "string"
            ? item.id
            : "",

        product_id:
          typeof item.product_id === "string"
            ? item.product_id
            : "",

        product_name:
          typeof item.product_name === "string"
            ? item.product_name
            : "",

        thumbnail:
          typeof item.thumbnail === "string"
            ? item.thumbnail
            : "",

        variant_name:
          typeof item.variant_name ===
          "string"
            ? item.variant_name
            : null,

        variant_value:
          typeof item.variant_value ===
          "string"
            ? item.variant_value
            : null,

        quantity: Number(
          item.quantity ?? 0
        ),

        unit_price: Number(
          item.unit_price ?? 0
        ),

        total_price: Number(
          item.total_price ?? 0
        ),

        status:
          typeof item.status === "string"
            ? (item.status as FulfillmentStatus)
            : "pending",
      }));

    return {
      id:
        typeof order.id === "string"
          ? order.id
          : "",

      order_number:
        typeof order.order_number ===
        "string"
          ? order.order_number
          : "",

      fulfillment_status:
        typeof order.fulfillment_status ===
        "string"
          ? (order.fulfillment_status as FulfillmentStatus)
          : "pending",

      payment_status:
        typeof order.payment_status ===
        "string"
          ? (order.payment_status as PaymentStatus)
          : "pending",

      total: Number(order.total ?? 0),

      created_at:
        typeof order.created_at ===
        "string"
          ? order.created_at
          : "",

      processing_at:
        typeof order.processing_at ===
        "string"
          ? order.processing_at
          : null,

      shipped_at:
        typeof order.shipped_at ===
        "string"
          ? order.shipped_at
          : null,

      delivered_at:
        typeof order.delivered_at ===
        "string"
          ? order.delivered_at
          : null,

      cancelled_at:
        typeof order.cancelled_at ===
        "string"
          ? order.cancelled_at
          : null,

      shipping_name:
        typeof order.shipping_name ===
        "string"
          ? order.shipping_name
          : "",

      shipping_phone:
        typeof order.shipping_phone ===
        "string"
          ? order.shipping_phone
          : "",

      shipping_address_line:
        typeof order.shipping_address_line ===
        "string"
          ? order.shipping_address_line
          : "",

      shipping_ward:
        typeof order.shipping_ward ===
        "string"
          ? order.shipping_ward
          : null,

      shipping_district:
        typeof order.shipping_district ===
        "string"
          ? order.shipping_district
          : null,

      shipping_region:
        typeof order.shipping_region ===
        "string"
          ? order.shipping_region
          : null,

      shipping_country:
        typeof order.shipping_country ===
        "string"
          ? order.shipping_country
          : null,

      shipping_postal_code:
        typeof order.shipping_postal_code ===
        "string"
          ? order.shipping_postal_code
          : null,

      order_items: items,
    };
  } catch {
    return null;
  }
};

/* ======================================================
   STATUS CONFIG
====================================================== */

function getStatusConfig(
  status: FulfillmentStatus
) {
  switch (status) {
    case "pending":
      return {
        icon: Clock3,
        color: "orange",
        bg: "bg-orange-500/10",
        border: "border-orange-500/20",
      };

    case "processing":
      return {
        icon: BadgeCheck,
        color: "blue",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
      };

    case "shipping":
      return {
        icon: Truck,
        color: "purple",
        bg: "bg-purple-500/10",
        border: "border-purple-500/20",
      };

    case "delivered":
      return {
        icon: PackageCheck,
        color: "emerald",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
      };

    case "cancelled":
      return {
        icon: CircleX,
        color: "red",
        bg: "bg-red-500/10",
        border: "border-red-500/20",
      };

    default:
      return {
        icon: Clock3,
        color: "gray",
        bg: "bg-gray-500/10",
        border: "border-gray-500/20",
      };
  }
}

/* ======================================================
   PAYMENT LABEL
====================================================== */

function getPaymentColor(
  status: PaymentStatus
) {
  switch (status) {
    case "paid":
      return "text-emerald-500";

    case "failed":
      return "text-red-500";

    case "refunded":
      return "text-orange-500";

    default:
      return "text-yellow-500";
  }
}

/* ======================================================
   PAGE
====================================================== */

export default function OrderDetailPage() {
  const { t } = useTranslation();

  const router = useRouter();
  const params = useParams();

  const { user, loading: authLoading } =
    useAuth();

  const orderId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : "";

  const { data: order, isLoading } = useSWR(
    user && orderId
      ? `/api/orders/${orderId}`
      : null,
    fetcher
  );

  /* ======================================================
     LOADING
  ====================================================== */

  if (isLoading || authLoading) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-3xl bg-[var(--card-bg)]"
            />
          ))}
        </div>
      </main>
    );
  }

  /* ======================================================
     EMPTY
  ====================================================== */

  if (!order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card-bg)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <CircleX className="h-8 w-8 text-red-500" />
          </div>

          <h1 className="text-xl font-bold">
            {t.order_not_found ??
              "Order not found"}
          </h1>

          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {t.order_not_found_desc ??
              "Unable to load this order"}
          </p>

          <button
            onClick={() => router.back()}
            className="mt-6 w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition active:scale-95"
          >
            {t.back ?? "Back"}
          </button>
        </div>
      </main>
    );
  }

  /* ======================================================
     DATA
  ====================================================== */

  const statusConfig = getStatusConfig(
    order.fulfillment_status
  );

  const StatusIcon = statusConfig.icon;

  const fullAddress = [
    order.shipping_address_line,
    order.shipping_ward,
    order.shipping_district,
    order.shipping_region,
  ]
    .filter(Boolean)
    .join(", ");

  const totalItems = useMemo(() => {
    return order.order_items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }, [order.order_items]);

  /* ======================================================
     UI
  ====================================================== */

  return (
    <main className="min-h-screen bg-[var(--background)] pb-40 text-[var(--foreground)]">
      {/* HEADER */}

      <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--nav-bg)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] transition active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">
              #{order.order_number}
            </h1>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {new Date(
                order.created_at
              ).toLocaleString()}
            </p>
          </div>

          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusConfig.bg} ${statusConfig.border}`}
          >
            <StatusIcon
              className={`h-4 w-4 text-${statusConfig.color}-500`}
            />

            <span
              className={`text-${statusConfig.color}-500`}
            >
              {t[
                `order_status_${order.fulfillment_status}`
              ] ??
                order.fulfillment_status}
            </span>
          </div>
        </div>
      </div>

      {/* CONTENT */}

      <div className="mx-auto mt-4 flex max-w-3xl flex-col gap-4 px-4">
        {/* OVERVIEW */}

        <section className="overflow-hidden rounded-3xl border border-orange-500/20 bg-[var(--card-bg)]">
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/20 p-3">
                <StatusIcon className="h-7 w-7" />
              </div>

              <div>
                <h2 className="text-lg font-bold">
                  {t[
                    `order_status_${order.fulfillment_status}`
                  ] ??
                    order.fulfillment_status}
                </h2>

                <p className="mt-1 text-sm text-white/90">
                  {t.order_detail_status_desc ??
                    "Track your order status in realtime"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <div className="rounded-2xl bg-[var(--card-secondary)] p-4">
              <p className="text-xs text-[var(--text-muted)]">
                {t.items ?? "Items"}
              </p>

              <p className="mt-1 text-lg font-bold">
                {totalItems}
              </p>
            </div>

            <div className="rounded-2xl bg-[var(--card-secondary)] p-4">
              <p className="text-xs text-[var(--text-muted)]">
                {t.total ?? "Total"}
              </p>

              <p className="mt-1 text-lg font-bold text-orange-500">
                π{formatPi(order.total)}
              </p>
            </div>

            <div className="rounded-2xl bg-[var(--card-secondary)] p-4">
              <p className="text-xs text-[var(--text-muted)]">
                {t.payment ?? "Payment"}
              </p>

              <p
                className={`mt-1 text-sm font-semibold ${getPaymentColor(
                  order.payment_status
                )}`}
              >
                {t[
                  `payment_status_${order.payment_status}`
                ] ??
                  order.payment_status}
              </p>
            </div>

            <div className="rounded-2xl bg-[var(--card-secondary)] p-4">
              <p className="text-xs text-[var(--text-muted)]">
                {t.order_id ?? "Order ID"}
              </p>

              <p className="mt-1 truncate text-sm font-semibold">
                {order.id.slice(0, 10)}
              </p>
            </div>
          </div>
        </section>

        {/* SHIPPING */}

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card-bg)] p-5">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-orange-500" />

            <h2 className="text-base font-bold">
              {t.shipping_address ??
                "Shipping Address"}
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-orange-500/10 p-2">
                <User className="h-4 w-4 text-orange-500" />
              </div>

              <div>
                <p className="font-semibold">
                  {order.shipping_name}
                </p>

                <div className="mt-1 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Phone className="h-4 w-4" />

                  {order.shipping_phone}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[var(--card-secondary)] p-4 text-sm leading-6">
              {fullAddress}

              {(order.shipping_country ||
                order.shipping_postal_code) && (
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {order.shipping_country}

                  {order.shipping_postal_code &&
                    ` · ${order.shipping_postal_code}`}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* TIMELINE */}

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card-bg)] p-5">
          <div className="mb-5 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-orange-500" />

            <h2 className="text-base font-bold">
              {t.order_timeline ??
                "Order Timeline"}
            </h2>
          </div>

          <div className="space-y-5">
            <TimelineItem
              active
              title={
                t.order_created ??
                "Order Created"
              }
              time={order.created_at}
            />

            <TimelineItem
              active={!!order.processing_at}
              title={
                t.order_processing ??
                "Processing"
              }
              time={order.processing_at}
            />

            <TimelineItem
              active={!!order.shipped_at}
              title={
                t.order_shipping ??
                "Shipping"
              }
              time={order.shipped_at}
            />

            <TimelineItem
              active={!!order.delivered_at}
              title={
                t.order_delivered ??
                "Delivered"
              }
              time={order.delivered_at}
            />

            {order.cancelled_at && (
              <TimelineItem
                active
                danger
                title={
                  t.order_cancelled ??
                  "Cancelled"
                }
                time={order.cancelled_at}
              />
            )}
          </div>
        </section>

        {/* PRODUCTS */}

        <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card-bg)]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-base font-bold">
              {t.products ?? "Products"}
            </h2>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {order.order_items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  router.push(
                    `/product/${item.product_id}`
                  )
                }
                className="flex w-full gap-4 p-4 text-left transition hover:bg-[var(--card-secondary)]"
              >
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card-secondary)]">
                  <Image
                    src={
                      item.thumbnail ||
                      "/placeholder.png"
                    }
                    alt={item.product_name}
                    fill
                    className="object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold">
                    {item.product_name}
                  </p>

                  {(item.variant_name ||
                    item.variant_value) && (
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {item.variant_name}:{" "}
                      {item.variant_value}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>
                      x{item.quantity}
                    </span>

                    <span>•</span>

                    <span>
                      π
                      {formatPi(
                        item.unit_price
                      )}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">
                        {t.subtotal ??
                          "Subtotal"}
                      </p>

                      <p className="text-base font-bold text-orange-500">
                        π
                        {formatPi(
                          item.total_price
                        )}
                      </p>
                    </div>

                    <ChevronRight className="h-5 w-5 text-[var(--text-muted)]" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* BOTTOM ACTIONS */}

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--nav-bg)]/95 p-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl gap-3">
          {order.fulfillment_status ===
            "delivered" && (
            <>
              <button
                onClick={() =>
                  router.push(
                    `/customer/orders/${order.id}/return`
                  )
                }
                className="flex-1 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-500 transition active:scale-95"
              >
                <span className="flex items-center justify-center gap-2">
                  <RefreshCcw className="h-4 w-4" />

                  {t.request_return ??
                    "Return"}
                </span>
              </button>

              {order.order_items?.[0] && (
                <button
                  onClick={() =>
                    router.push(
                      `/product/${order.order_items[0].product_id}`
                    )
                  }
                  className="flex-1 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition active:scale-95"
                >
                  <span className="flex items-center justify-center gap-2">
                    <ShoppingBag className="h-4 w-4" />

                    {t.buy_again ??
                      "Buy Again"}
                  </span>
                </button>
              )}
            </>
          )}

          {order.fulfillment_status ===
            "cancelled" && (
            <>
              <button className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3 text-sm font-semibold transition active:scale-95">
                <span className="flex items-center justify-center gap-2">
                  <CreditCard className="h-4 w-4" />

                  {t.payment_detail ??
                    "Payment Detail"}
                </span>
              </button>

              {order.order_items?.[0] && (
                <button
                  onClick={() =>
                    router.push(
                      `/product/${order.order_items[0].product_id}`
                    )
                  }
                  className="flex-1 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition active:scale-95"
                >
                  {t.buy_again ??
                    "Buy Again"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/* ======================================================
   TIMELINE ITEM
====================================================== */

type TimelineItemProps = {
  active: boolean;
  title: string;
  time?: string | null;
  danger?: boolean;
};

function TimelineItem({
  active,
  title,
  time,
  danger = false,
}: TimelineItemProps) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`h-3.5 w-3.5 rounded-full ${
            active
              ? danger
                ? "bg-red-500"
                : "bg-orange-500"
              : "bg-gray-300"
          }`}
        />

        <div className="mt-1 h-full w-px bg-[var(--border)]" />
      </div>

      <div className="pb-2">
        <p
          className={`text-sm font-semibold ${
            active
              ? danger
                ? "text-red-500"
                : "text-[var(--foreground)]"
              : "text-[var(--text-muted)]"
          }`}
        >
          {title}
        </p>

        {time && (
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {new Date(time).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
