"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import OrderCard from "./OrderCard";
import OrderActions from "./OrderActions";

import type {
  Order,
  OrderFilter,
  OrderStatus,
} from "../types";

/* =========================================================
   TYPES
========================================================= */

type OrderTab =
  | "all"
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled";

type Props = {
  orders: Order[];

  filter: OrderFilter;

  onFilterChange: (
    filter: OrderFilter
  ) => void;

  loadingId?: string | null;

  onDetail: (
    id: string
  ) => void;

  onConfirm: (
    id: string
  ) => void;

  onCancel: (
    id: string
  ) => void;

  onShipping: (
    id: string
  ) => void;
};

/* =========================================================
   COMPONENT
========================================================= */

export default function OrdersList({
  orders,

  filter,
  onFilterChange,

  loadingId,

  onDetail,
  onConfirm,
  onCancel,
  onShipping,
}: Props) {
  const { t } =
    useTranslation();

  /* ======================================================
     TAB
  ====================================================== */

  const [tab, setTab] =
    useState<OrderTab>(
      filter.status
    );

  useEffect(() => {
    setTab(filter.status);
  }, [filter.status]);

  /* ======================================================
     TABS
  ====================================================== */

  const tabs: Array<
    [OrderTab, string]
  > = [
    [
      "all",
      t.all ?? "All",
    ],
    [
      "pending",
      t.pending_orders ??
        "Pending",
    ],
  
    [
      "processing",
      t.processing_orders ??
        "Processing",
    ],
    [
      "shipped",
      t.shipped_orders ??
        "Shipped",
    ],
    [
      "delivered",
      t.delivered_orders ??
        "Delivered",
    ],
    [
      "completed",
      t.completed_orders ??
        "Completed",
    ],
    [
      "cancelled",
      t.cancelled_orders ??
        "Cancelled",
    ],
  ];

  /* ======================================================
     COUNTS
  ====================================================== */

  const counts =
    useMemo(() => {
      const map: Record<OrderTab, number> = {
  all: orders.length,

  pending: 0,
  processing: 0,
  shipped: 0,
  delivered: 0,
  completed: 0,
  cancelled: 0,
};

      for (const order of orders) {
        map[
          order.fulfillment_status
        ]++;
      }

      return map;
    }, [orders]);

  /* ======================================================
     FILTERED
  ====================================================== */

  const filtered =
    useMemo(() => {
      if (tab === "all") {
        return orders;
      }

      return orders.filter(
        (order) =>
          order.fulfillment_status ===
          tab
      );
    }, [
      orders,
      tab,
    ]);
    /* ======================================================
     TAB CHANGE
  ====================================================== */

  function handleTabChange(
    nextTab: OrderTab
  ) {
    setTab(nextTab);

    onFilterChange({
      ...filter,
      status: nextTab,
    });
  }

  /* ======================================================
     UI
  ====================================================== */

  return (
    <section className="w-full">

      {/* ================= TABS ================= */}
className="sticky top-0 z-20 overflow-x-auto border-b border-[color:color-mix(in_srgb,var(--color-primary)_20%,transparent)] bg-[var(--surface-1)]"

        <div className="flex min-w-max gap-2 px-3 py-2">

          {tabs.map(([key, label]) => {
            const active =
              tab === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  handleTabChange(
                    key
                  )
                }
                className={`
                  shrink-0
                  flex
                  items-center
                  gap-2
                  rounded-xl
                  border
                  px-4
                  py-2
                  text-sm
                  font-medium
                  transition-all

                  ${
                    active
                   ? "border-[var(--color-primary)] bg-[color:color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]"
                     : "border-[var(--border-color)] bg-[var(--surface-1)] text-[var(--text-secondary)]"
                  }
                `}
              >
                <span>
                  {label}
                </span>

                <span
                  className={`
                    rounded-full
                    px-2
                    py-0.5
                    text-xs

                    ${
                      active
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--surface-3)] text-[var(--text-muted)]"
                    }
                  `}
                >
                  {counts[key]}
                </span>
              </button>
            );
          })}

        </div>

      </div>

      {/* ================= LIST ================= */}

      <div className="space-y-4 p-4">
                {filtered.length === 0 ? (

          <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center text-sm text-[var(--text-muted)]">
          
            {t.no_orders ??
              "No orders"}
          </div>

        ) : (

          filtered.map(
            (order) => (

              <OrderCard
                key={order.id}
                order={order}
                onClick={() =>
                  onDetail(
                    order.id
                  )
                }
                actions={
                  <OrderActions
                    orderId={
                      order.id
                    }
                    status={
                      order.fulfillment_status
                    }
                    loading={
                      loadingId ===
                      order.id
                    }
                    onDetail={() =>
                      onDetail(
                        order.id
                      )
                    }
                    onConfirm={() =>
                      onConfirm(
                        order.id
                      )
                    }
                    onCancel={() =>
                      onCancel(
                        order.id
                      )
                    }
                    onShipping={() =>
                      onShipping(
                        order.id
                      )
                    }
                  />
                }
              />

            )
          )

        )}

      </div>

    </section>
  );
}
