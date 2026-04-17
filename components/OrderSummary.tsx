"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import { getPiAccessToken } from "@/lib/piAuth";

import {
  Clock3,
  BadgeCheck,
  Truck,
  Star,
  RotateCcw,
} from "lucide-react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* =====================================================
   FETCHER
===================================================== */

const fetcher = async (url: string) => {
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

    return await res.json();
  } catch {
    return null;
  }
};

/* =====================================================
   COMPONENT
===================================================== */

export default function OrderSummary() {
  const { t } = useTranslation();
  const router = useRouter();

  const { data, isLoading } = useSWR(
    "/api/orders/count",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  /* safe count */
  const counts = {
    pending: Number(data?.pending ?? 0),
    confirmed: Number(data?.confirmed ?? 0),
    shipping: Number(data?.shipping ?? 0),
    completed: Number(data?.completed ?? 0),
    cancelled: Number(data?.cancelled ?? 0),
  };

  /* helper push status */
  function go(status: string) {
    router.push(
      `/customer/orders?tab=${status}`
    );
  }

  return (
    <section className="bg-white mx-4 mt-4 rounded-2xl border shadow-sm overflow-hidden">
      {/* HEADER */}
      <div
        onClick={() =>
          router.push("/customer/orders")
        }
        className="px-4 py-4 border-b flex items-center justify-between cursor-pointer active:bg-gray-50"
      >
        <h2 className="text-base font-semibold text-gray-800">
          {t.orders ?? "Orders"}
        </h2>

        <span className="text-orange-500 font-bold text-lg">
          →
        </span>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-5 py-4">
        <Item
          icon={<Clock3 size={20} />}
          label={
            t.pending_orders ??
            "Pending"
          }
          count={counts.pending}
          loading={isLoading}
          onClick={() =>
            go("pending")
          }
        />

        <Item
          icon={
            <BadgeCheck size={20} />
          }
          label={
            t.confirmed_orders ??
            "Confirmed"
          }
          count={counts.confirmed}
          loading={isLoading}
          onClick={() =>
            go("confirmed")
          }
        />

        <Item
          icon={<Truck size={20} />}
          label={
            t.shipping_orders ??
            "Shipping"
          }
          count={counts.shipping}
          loading={isLoading}
          onClick={() =>
            go("shipping")
          }
        />

        <Item
          icon={<Star size={20} />}
          label={
            t.completed_orders ??
            "Completed"
          }
          count={counts.completed}
          loading={isLoading}
          onClick={() =>
            go("completed")
          }
        />

        <Item
          icon={
            <RotateCcw size={20} />
          }
          label={
            t.cancelled_orders ??
            "Cancelled"
          }
          count={counts.cancelled}
          loading={isLoading}
          onClick={() =>
            go("cancelled")
          }
        />
      </div>
    </section>
  );
}

/* =====================================================
   ITEM
===================================================== */

function Item({
  icon,
  label,
  count,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-start h-[88px] px-1 active:scale-95 transition"
    >
      {/* ICON */}
      <div className="relative flex items-center justify-center w-11 h-11 rounded-full bg-gray-100 shadow-sm mb-1 text-gray-700">
        {icon}

        {/* BADGE */}
        {loading ? (
          <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-gray-300 animate-pulse" />
        ) : typeof count ===
            "number" &&
          count > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {count > 99
              ? "99+"
              : count}
          </span>
        ) : null}
      </div>

      {/* TEXT */}
      <span className="text-[11px] leading-tight text-center text-gray-700 line-clamp-2">
        {label}
      </span>
    </button>
  );
}
