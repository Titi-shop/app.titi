
"use client";

import {
  Suspense,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import Header from "./components/Header";
import FilterBar from "./components/FilterBar";
import OrdersList from "./components/OrdersList";

import {
  ConfirmDialog,
  CancelDialog,
  ShippingDialog,
} from "./components/Dialogs";

import { useOrders } from "./hooks/useOrders";

import {
  calculateStats,
  filterOrders,
} from "./lib/helpers";

import {
  confirmOrder,
  cancelOrder,
  startShipping,
} from "./lib/api";

import type {
  Order,
  OrderFilter,
} from "./types";

/* =========================================================
   CONTENT
========================================================= */

function SellerOrdersContent() {
  const router = useRouter();

  const { t } =
    useTranslation();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const {
    orders,
    loading,
    mutate,
  } = useOrders(
    !!user && !authLoading
  );

  /* ======================================================
     FILTER
  ====================================================== */

  const [
    filter,
    setFilter,
  ] = useState<OrderFilter>({
    keyword: "",
    from: "",
    to: "",
    status: "all",
  });

  /* ======================================================
     DIALOGS
  ====================================================== */

  const [
    confirmId,
    setConfirmId,
  ] = useState<string | null>(
    null
  );

  const [
    cancelId,
    setCancelId,
  ] = useState<string | null>(
    null
  );

  const [
    shippingId,
    setShippingId,
  ] = useState<string | null>(
    null
  );

  /* ======================================================
     FORM
  ====================================================== */

  const [
    sellerMessage,
    setSellerMessage,
  ] = useState(
    ""
  );

  const [
    cancelReason,
    setCancelReason,
  ] = useState(
    ""
  );

  const [
    customReason,
    setCustomReason,
  ] = useState(
    ""
  );

  /* ======================================================
     LOADING
  ====================================================== */

  const [
    loadingId,
    setLoadingId,
  ] = useState<string | null>(
    null
  );

  /* ======================================================
     FILTERED
  ====================================================== */

  const filtered =
    useMemo(() => {
      return filterOrders(
        orders,
        filter.keyword
      );
    }, [
      orders,
      filter.keyword,
    ]);

  /* ======================================================
     STATS
  ====================================================== */

  const stats =
    useMemo(
      () =>
        calculateStats(
          filtered
        ),
      [filtered]
    );

  const totalAmount =
    useMemo(
      () =>
        filtered.reduce(
          (
            sum,
            order
          ) =>
            sum +
            order.total,
          0
        ),
      [filtered]
    );

  const cancelReasons =
    useMemo(
      () => [
        t.cancel_reason_out_of_stock ??
          "Out of stock",

        t.cancel_reason_discontinued ??
          "Discontinued",

        t.cancel_reason_wrong_price ??
          "Wrong price",

        t.cancel_reason_other ??
          "Other",
      ],
      [t]
    );
    /* ======================================================
     ACTIONS
  ====================================================== */

  async function handleConfirm() {
    if (!confirmId) return;

    try {
      setLoadingId(confirmId);

      await mutate(
        (current = []) =>
          current.filter(
            (order) =>
              order.id !== confirmId
          ),
        false
      );

      await confirmOrder(
        confirmId,
        sellerMessage
      );

      setConfirmId(null);
      setSellerMessage("");

      mutate();

    } catch {
      mutate();
    } finally {
      setLoadingId(null);
    }
  }

  async function handleCancel() {
    if (!cancelId) return;

    const reason =
      cancelReason ===
      (t.cancel_reason_other ??
        "Other")
        ? customReason.trim()
        : cancelReason;

    if (!reason) return;

    try {
      setLoadingId(cancelId);

      await mutate(
        (current = []) =>
          current.filter(
            (order) =>
              order.id !== cancelId
          ),
        false
      );

      await cancelOrder(
        cancelId,
        reason
      );

      setCancelId(null);
      setCancelReason("");
      setCustomReason("");

      mutate();

    } catch {
      mutate();
    } finally {
      setLoadingId(null);
    }
  }

  async function handleShipping() {
    if (!shippingId) return;

    try {
      setLoadingId(shippingId);

      await mutate(
        (current = []) =>
          current.map((order) =>
            order.id === shippingId
              ? {
                  ...order,
                  fulfillment_status:
                    "shipped",
                }
              : order
          ),
        false
      );

      await startShipping(
        shippingId
      );

      setShippingId(null);

      mutate();

    } catch {
      mutate();
    } finally {
      setLoadingId(null);
    }
  }
  /* ======================================================
     LOADING
  ====================================================== */

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-gray-100 dark:bg-zinc-950">
        <div className="space-y-4 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl bg-white dark:bg-zinc-900"
            />
          ))}
        </div>
      </main>
    );
  }

  /* ======================================================
     UI
  ====================================================== */

  return (
    <main className="min-h-screen bg-gray-100 pb-24 dark:bg-zinc-950">

      <Header
        title={
          t.seller_orders ??
          "Seller Orders"
        }
        totalOrders={
          filtered.length
        }
        totalAmount={
          totalAmount
        }
      />

      <FilterBar
        value={filter}
        onChange={setFilter}
      />

      <section className="px-4 pb-24">

    <OrdersList
  orders={filtered}
  filter={filter}
  onFilterChange={setFilter}
  loadingId={loadingId}
  onDetail={(id) =>
    router.push(`/seller/orders/${id}`)

  }

          onConfirm={(id) => {
            setConfirmId(id);
            setCancelId(null);
            setShippingId(null);

            setSellerMessage(
              t.order_thank_you_message ??
                "Thank you ❤️"
            );
          }}
          onCancel={(id) => {
            setCancelId(id);
            setConfirmId(null);
            setShippingId(null);

            setCancelReason("");
            setCustomReason("");
          }}
          onShipping={(id) => {
            setShippingId(id);
            setConfirmId(null);
            setCancelId(null);
          }}
        />

        <ConfirmDialog
          open={
            confirmId !== null
          }
          loading={
            loadingId ===
            confirmId
          }
          message={
            sellerMessage
          }
          onMessageChange={
            setSellerMessage
          }
          onConfirm={
            handleConfirm
          }
          onClose={() =>
            setConfirmId(null)
          }
        />

        <CancelDialog
          open={
            cancelId !== null
          }
          loading={
            loadingId ===
            cancelId
          }
          reasons={
            cancelReasons
          }
          selected={
            cancelReason
          }
          custom={
            customReason
          }
          onSelect={
            setCancelReason
          }
          onCustomChange={
            setCustomReason
          }
          onConfirm={
            handleCancel
          }
          onClose={() =>
            setCancelId(null)
          }
        />

        <ShippingDialog
          open={
            shippingId !== null
          }
          loading={
            loadingId ===
            shippingId
          }
          onConfirm={
            handleShipping
          }
          onClose={() =>
            setShippingId(null)
          }
        />

      </section>
    </main>
  );
  }

/* =========================================================
   PAGE
========================================================= */

export default function SellerOrdersPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-100 dark:bg-zinc-950">
          <div className="space-y-4 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-36 animate-pulse rounded-2xl bg-white dark:bg-zinc-900"
              />
            ))}
          </div>
        </main>
      }
    >
      <SellerOrdersContent />
    </Suspense>
  );
}
