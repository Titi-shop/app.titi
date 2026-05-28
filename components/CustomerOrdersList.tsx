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

import {
  ORDER_STATUS,
  type OrderStatus,
} from "@/constants/order-status";

/* =======================================================
   TYPES
======================================================= */

type OrderTab =
  | "all"
  | "pending"
  | "processing"
  | "shipping"
  | "completed"
  | "cancelled";

type FulfillmentStatus = OrderStatus;

type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

type Order = {
  id: string;
  fulfillment_status?: FulfillmentStatus;
  payment_status?: PaymentStatus;
  status?: string;
  order_items?: unknown[];
};

/* =======================================================
   STATE MACHINE (V7 - SINGLE SOURCE OF TRUTH)
======================================================= */

function normalizeStatus(order: Order): OrderStatus {
  const f = order.fulfillment_status;
  const p = order.payment_status;
  const legacy = order.status;

  // 🟡 PENDING FLOW
  if (f === ORDER_STATUS.PENDING_FULFILLMENT) {
    return ORDER_STATUS.PENDING;
  }

  if (p === "pending") {
    return ORDER_STATUS.PENDING;
  }

  // 🟠 PROCESSING
  if (f === ORDER_STATUS.PROCESSING) {
    return ORDER_STATUS.PROCESSING;
  }

  // 🚚 SHIPPING FLOW
  if (
    f === ORDER_STATUS.SHIPPED ||
    f === ORDER_STATUS.DELIVERED
  ) {
    return ORDER_STATUS.SHIPPED;
  }

  // ✅ COMPLETED
  if (f === ORDER_STATUS.COMPLETED) {
    return ORDER_STATUS.COMPLETED;
  }

  // ❌ CANCELLED FLOW
  if (
    f === ORDER_STATUS.CANCELLED ||
    f === ORDER_STATUS.REFUNDED ||
    p === "failed" ||
    p === "refunded"
  ) {
    return ORDER_STATUS.CANCELLED;
  }

  // fallback legacy safety
  if (
    legacy &&
    Object.values(ORDER_STATUS).includes(legacy as OrderStatus)
  ) {
    return legacy as OrderStatus;
  }

  return ORDER_STATUS.PENDING;
}

/* =======================================================
   COMPONENT
======================================================= */

type Props = {
  orders: Order[];
  initialTab?: OrderTab;

  onDetail: (id: string) => void;
  onCancel?: (id: string) => void;
  onReceived?: (id: string) => void;
  onBuyAgain?: (id: string) => void;
  onReview?: (id: string) => void;

  reviewedMap?: Record<string, boolean>;
};

export default function CustomerOrdersList(props: Props) {
  return (
    <Suspense fallback={<div className="p-4 h-12 bg-white animate-pulse rounded-xl" />}>
      <Inner {...props} />
    </Suspense>
  );
}

/* =======================================================
   INNER
======================================================= */

function Inner({
  orders,
  initialTab = "all",
  onDetail,
  onCancel,
  onReceived,
  onBuyAgain,
  onReview,
  reviewedMap,
}: Props) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();

  const urlTab = searchParams.get("tab") as OrderTab | null;

  const safeTab: OrderTab =
    urlTab &&
    ["all", "pending", "processing", "shipping", "completed", "cancelled"].includes(urlTab)
      ? urlTab
      : initialTab;

  const [tab, setTab] = useState<OrderTab>(safeTab);

  useEffect(() => {
    setTab(safeTab);
  }, [safeTab]);

  /* ================= TABS ================= */

  const tabs: Array<[OrderTab, string]> = [
    ["all", t.all ?? "All"],
    ["pending", t.order_pending ?? "Pending"],
    ["processing", t.order_processing ?? "Processing"],
    ["shipping", t.order_shipping ?? "Shipping"],
    ["completed", t.order_completed ?? "Completed"],
    ["cancelled", t.order_cancelled ?? "Cancelled"],
  ];

  /* ================= COUNTS ================= */

  const counts = useMemo(() => {
    const map: Record<OrderTab, number> = {
      all: orders.length,
      pending: 0,
      processing: 0,
      shipping: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const o of orders) {
      const s = normalizeStatus(o);

      switch (s) {
        case ORDER_STATUS.PENDING:
          map.pending++;
          break;
        case ORDER_STATUS.PROCESSING:
          map.processing++;
          break;
        case ORDER_STATUS.SHIPPED:
          map.shipping++;
          break;
        case ORDER_STATUS.COMPLETED:
          map.completed++;
          break;
        case ORDER_STATUS.CANCELLED:
          map.cancelled++;
          break;
      }
    }

    return map;
  }, [orders]);

  /* ================= FILTER ================= */

  const filtered = useMemo(() => {
    if (tab === "all") return orders;

    return orders.filter((o) => {
      const s = normalizeStatus(o);

      if (tab === "shipping") {
        return (
          s === ORDER_STATUS.SHIPPED ||
          s === ORDER_STATUS.DELIVERED
        );
      }

      return s === tab;
    });
  }, [orders, tab]);

  /* ================= UI ================= */

  return (
  <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
    <div className="sticky top-0 z-10 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 overflow-x-auto whitespace-nowrap">
      <div className="flex min-w-max px-2">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-3 text-sm border-b-2 ${
              tab === key
                ? "border-orange-500 text-orange-500 dark:text-orange-400 font-semibold"
                : "border-transparent text-gray-600 dark:text-gray-400"
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>
    </div>

    {/* LIST */}
    <div className="p-4 space-y-4 bg-gray-50 dark:bg-black">
      {filtered.length === 0 ? (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 p-8 rounded-xl">
          {t.no_orders ?? "No orders"}
        </div>
      ) : (
        filtered.map((order) => (
          <CustomerOrderCard
            key={order.id}
            order={order}
            reviewed={reviewedMap?.[order.id] ?? false}
            onDetail={() => onDetail(order.id)}
            onCancel={() => onCancel?.(order.id)}
            onReceived={() => onReceived?.(order.id)}
            onBuyAgain={() => onBuyAgain?.(order.id)}
            onReview={() => onReview?.(order.id)}
          />
        ))
      )}
    </div>
  </div>
);
}
