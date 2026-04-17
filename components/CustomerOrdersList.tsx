"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

import CustomerOrderCard from "./CustomerOrderCard";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* =======================================================
   TYPES
======================================================= */

type OrderStatus =
  | "all"
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "cancelled";

type OrderItem = {
  id?: string;
  product_id?: string;
  product_name?: string;
};

type Order = {
  id: string;
  status: string;
  order_items?: OrderItem[];
};

type Props = {
  orders: Order[];
  initialTab?: OrderStatus;

  onDetail: (id: string) => void;
  onCancel?: (id: string) => void;
  onReceived?: (id: string) => void;
  onBuyAgain?: (id: string) => void;
  onReview?: (id: string) => void;

  reviewedMap?: Record<string, boolean>;
};

/* =======================================================
   WRAPPER
======================================================= */

export default function CustomerOrdersList(
  props: Props
) {
  return (
    <Suspense
      fallback={
        <div className="p-4">
          <div className="h-12 rounded-xl bg-white animate-pulse" />
        </div>
      }
    >
      <CustomerOrdersListInner
        {...props}
      />
    </Suspense>
  );
}

/* =======================================================
   INNER
======================================================= */

function CustomerOrdersListInner({
  orders,
  initialTab = "all",
  onDetail,
  onCancel,
  onReceived,
  onBuyAgain,
  onReview,
  reviewedMap,
}: Props) {
  const { t } =
    useTranslation();

  const searchParams =
    useSearchParams();

  /* ================= URL TAB ================= */

  const rawTab =
    searchParams.get("tab") ??
    initialTab;

  const safeTab: OrderStatus =
    rawTab === "pending" ||
    rawTab === "confirmed" ||
    rawTab === "shipping" ||
    rawTab === "completed" ||
    rawTab === "cancelled" ||
    rawTab === "all"
      ? rawTab
      : "all";

  /* ================= TAB STATE ================= */

  const [tab, setTab] =
    useState<OrderStatus>(
      safeTab
    );

  useEffect(() => {
    setTab(safeTab);
  }, [safeTab]);

  /* ================= TABS ================= */

  const tabs: Array<
    [OrderStatus, string]
  > = [
    [
      "all",
      t.all ?? "All",
    ],
    [
      "pending",
      t.order_pending ??
        "Pending",
    ],
    [
      "confirmed",
      t.order_confirmed ??
        "Confirmed",
    ],
    [
      "shipping",
      t.order_shipping ??
        "Shipping",
    ],
    [
      "completed",
      t.order_completed ??
        "Completed",
    ],
    [
      "cancelled",
      t.order_cancelled ??
        "Cancelled",
    ],
  ];

  /* ================= COUNTS ================= */

  const counts = useMemo(() => {
    const map: Record<
      OrderStatus,
      number
    > = {
      all: orders.length,
      pending: 0,
      confirmed: 0,
      shipping: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const order of orders) {
      const status =
        order.status;

      if (
        status ===
          "pending" ||
        status ===
          "confirmed" ||
        status ===
          "shipping" ||
        status ===
          "completed" ||
        status ===
          "cancelled"
      ) {
        map[status] += 1;
      }
    }

    return map;
  }, [orders]);

  /* ================= FILTERED ================= */

  const filtered =
    useMemo(() => {
      if (tab === "all") {
        return orders;
      }

      return orders.filter(
        (order) =>
          order.status ===
          tab
      );
    }, [orders, tab]);

  /* ================= UI ================= */

  return (
    <>
      {/* TABS */}
      <div className="sticky top-0 z-10 overflow-x-auto border-b bg-white whitespace-nowrap">
        <div className="flex min-w-max px-2">
          {tabs.map(
            ([
              key,
              label,
            ]) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setTab(
                    key
                  )
                }
                className={`border-b-2 px-4 py-3 text-sm transition ${
                  tab ===
                  key
                    ? "border-orange-500 font-semibold text-orange-500"
                    : "border-transparent text-gray-500"
                }`}
              >
                {label} (
                {counts[
                  key
                ] ?? 0}
                )
              </button>
            )
          )}
        </div>
      </div>

      {/* LIST */}
      <div className="space-y-4 p-4">
        {filtered.length ===
        0 ? (
          <div className="rounded-xl bg-white p-8 text-center text-sm text-gray-400">
            {t.no_orders ??
              "No orders"}
          </div>
        ) : (
          filtered.map(
            (
              order
            ) => (
              <CustomerOrderCard
                key={
                  order.id
                }
                order={
                  order
                }
                reviewed={
                  reviewedMap?.[
                    order
                      .id
                  ] ??
                  false
                }
                onDetail={() =>
                  onDetail(
                    order.id
                  )
                }
                onCancel={() =>
                  onCancel?.(
                    order.id
                  )
                }
                onReceived={() =>
                  onReceived?.(
                    order.id
                  )
                }
                onBuyAgain={() =>
                  onBuyAgain?.(
                    order.id
                  )
                }
                onReview={() =>
                  onReview?.(
                    order.id
                  )
                }
              />
            )
          )
        )}
      </div>
    </>
  );
}
