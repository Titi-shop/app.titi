"use client";

import {
  useMemo,
  useState,
  useEffect,
} from "react";
import { useSearchParams } from "next/navigation";

import CustomerOrderCard from "./CustomerOrderCard";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

type Props = {
  orders: any[];
  initialTab?: string;

  onDetail: (id: string) => void;
  onCancel?: (id: string) => void;
  onReceived?: (id: string) => void;
  onBuyAgain?: (id: string) => void;
  onReview?: (id: string) => void;

  reviewedMap?: Record<string, boolean>;
};

export default function CustomerOrdersList({
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

  /* ================= URL TAB ================= */
  const searchParams = useSearchParams();

  const urlTab =
    searchParams.get("tab") ||
    initialTab ||
    "all";

  /* ================= TAB STATE ================= */
  const [tab, setTab] =
    useState(urlTab);

  useEffect(() => {
    setTab(urlTab);
  }, [urlTab]);

  /* ================= TABS ================= */
  const tabs = [
    ["all", t.all ?? "All"],
    ["pending", t.order_pending ?? "Pending"],
    ["confirmed", t.order_confirmed ?? "Confirmed"],
    ["shipping", t.order_shipping ?? "Shipping"],
    ["completed", t.order_completed ?? "Completed"],
    ["cancelled", t.order_cancelled ?? "Cancelled"],
  ];

  /* ================= COUNTS ================= */
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      all: orders.length,
      pending: 0,
      confirmed: 0,
      shipping: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const o of orders) {
      if (map[o.status] !== undefined) {
        map[o.status]++;
      }
    }

    return map;
  }, [orders]);

  /* ================= FILTERED ================= */
  const filtered = useMemo(() => {
    if (tab === "all") return orders;

    return orders.filter(
      (o) => o.status === tab
    );
  }, [orders, tab]);

  /* ================= UI ================= */
  return (
    <>
      {/* TABS */}
      <div className="sticky top-0 z-10 bg-white border-b overflow-x-auto whitespace-nowrap">
        <div className="flex min-w-max px-2">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-3 border-b-2 text-sm transition ${
                tab === key
                  ? "border-orange-500 text-orange-500 font-semibold"
                  : "border-transparent text-gray-500"
              }`}
            >
              {label} ({counts[key] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {/* LIST */}
      <div className="p-4 space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-sm text-gray-400">
            {t.no_orders ?? "No orders"}
          </div>
        ) : (
          filtered.map((order) => (
            <CustomerOrderCard
              key={order.id}
              order={order}
              reviewed={
                reviewedMap?.[order.id]
              }
              onDetail={() =>
                onDetail(order.id)
              }
              onCancel={() =>
                onCancel?.(order.id)
              }
              onReceived={() =>
                onReceived?.(order.id)
              }
              onBuyAgain={() =>
                onBuyAgain?.(order.id)
              }
              onReview={() =>
                onReview?.(order.id)
              }
            />
          ))
        )}
      </div>
    </>
  );
}
