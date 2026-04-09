"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import { getPiAccessToken } from "@/lib/piAuth";
import {
  Clock,
  Package,
  Truck,
  RotateCcw,
} from "lucide-react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

const fetcher = async (url: string) => {
  const token = await getPiAccessToken();

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("FETCH_FAILED");

  return res.json();
};

export default function OrderSummary() {
  const { t } = useTranslation();
  const router = useRouter();

  const { data, isLoading } = useSWR(
    "/api/orders/count",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  const counts = {
    pending: data?.pending ?? 0,
    pickup: data?.pickup ?? 0,
    shipping: data?.shipping ?? 0,
    completed: data?.completed ?? 0,
  };

  if (isLoading) {
    return (
      <section className="bg-white mx-4 mt-4 rounded-xl shadow p-4 text-center text-gray-400">
        {t.loading_orders || "Loading orders..."}
      </section>
    );
  }

  return (
    <section className="bg-white mx-4 mt-4 rounded-xl shadow border border-gray-100">
      <div
        onClick={() => router.push("/customer/orders")}
        className="p-4 border-b flex justify-between items-center cursor-pointer hover:bg-gray-50 transition"
      >
        <h2 className="text-lg font-semibold text-gray-800">
          {t.orders}
        </h2>

        <span className="text-lg text-orange-600 font-semibold">
          →
        </span>
      </div>

      <div className="grid grid-cols-5 py-4">
        <Item icon={<Clock size={22} />} label={t.pending_orders} path="/customer/pending" count={counts.pending} />
        <Item icon={<Package size={22} />} label={t.pickup_orders} path="/customer/pickup" count={counts.pickup} />
        <Item icon={<Truck size={22} />} label={t.shipping_orders} path="/customer/shipping" count={counts.shipping} />
        <Item icon={<Package size={22} />} label={t.completed_orders} path="/customer/completed" count={counts.completed} />
        <Item icon={<RotateCcw size={22} />} label={t.return_orders} path="/customer/returns" />
      </div>
    </section>
  );
}

function Item({
  icon,
  label,
  path,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  path: string;
  count?: number;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(path)}
      className="flex flex-col items-center justify-start h-[88px] text-gray-700 hover:text-orange-500 transition"
    >
      <div className="relative flex items-center justify-center w-11 h-11 rounded-full bg-gray-100 shadow-sm mb-1">
        {icon}

        {typeof count === "number" && count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full font-semibold shadow animate-pulse">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </div>

      <span className="text-[11px] leading-snug text-center line-clamp-2 max-w-[64px]">
        {label}
      </span>
    </button>
  );
}
