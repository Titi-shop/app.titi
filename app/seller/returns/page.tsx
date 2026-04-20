"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* ================= TYPES ================= */

type ReturnStatus =
  | "pending"
  | "approved"
  | "shipping_back"
  | "received"
  | "refund_pending"
  | "refunded"
  | "rejected";

type ReturnItem = {
  id: string;
  return_number: string;
  status: ReturnStatus;
  created_at: string | null;
  product_name: string;
  thumbnail: string;
  quantity: number;
};

/* ================= PAGE ================= */

export default function SellerReturnsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  const [items, setItems] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ReturnStatus | "all">("all");

  /* ================= LOAD ================= */

  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [authLoading, user, tab]);

  async function load() {
    try {
      const url =
        tab === "all"
          ? "/api/seller/returns"
          : `/api/seller/returns?status=${tab}`;

      const res = await apiAuthFetch(url);

      if (!res.ok) return;

      const json = await res.json();
      const list = Array.isArray(json)
        ? json
        : Array.isArray(json.items)
        ? json.items
        : [];

      setItems(list);
    } catch (err) {
      console.error("💥 LOAD ERROR:", err);
    } finally {
      setLoading(false);
    }
  }

  /* ================= STATUS ================= */

  function getStatusLabel(status: string) {
    return t[status] ?? status;
  }

  function getColor(status: string) {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "approved":
        return "bg-blue-100 text-blue-700";
      case "shipping_back":
        return "bg-indigo-100 text-indigo-700";
      case "received":
        return "bg-purple-100 text-purple-700";
      case "refund_pending":
        return "bg-orange-100 text-orange-700";
      case "refunded":
        return "bg-green-100 text-green-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  /* ================= TABS ================= */

  const tabs: (ReturnStatus | "all")[] = [
    "all",
    "pending",
    "approved",
    "shipping_back",
    "received",
    "refund_pending",
    "refunded",
    "rejected",
  ];

  function getTabLabel(tab: string) {
    return t[tab] ?? tab;
  }

  /* ================= UI ================= */

  if (authLoading || loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        {t.loading}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 pb-20">

      {/* HEADER */}
      <div className="bg-white px-4 py-3 border-b sticky top-0 z-10">
        <h1 className="font-semibold text-lg">
          🔄 {t.return_orders}
        </h1>
      </div>

      {/* TABS */}
      <div className="bg-white overflow-x-auto border-b">
        <div className="flex gap-3 px-3 py-2 min-w-max">
          {tabs.map((tKey) => (
            <button
              key={tKey}
              onClick={() => setTab(tKey)}
              className={`px-3 py-1 text-sm rounded-full border ${
                tab === tKey
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {getTabLabel(tKey)}
            </button>
          ))}
        </div>
      </div>

      {/* LIST */}
      <div className="p-3 space-y-3">

        {!loading && items.length === 0 && (
          <div className="bg-white p-6 text-center text-gray-500 rounded-xl">
            {t.no_returns}
          </div>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            onClick={() =>
              router.push(`/seller/returns/${item.id}`)
            }
            className="bg-white rounded-xl p-3 flex gap-3 shadow-sm hover:shadow-md transition cursor-pointer"
          >
            {/* IMAGE */}
            <img
              src={item.thumbnail || "/placeholder.png"}
              className="w-20 h-20 object-cover rounded"
              onError={(e) => {
                e.currentTarget.src = "/placeholder.png";
              }}
            />

            {/* INFO */}
            <div className="flex-1 flex flex-col justify-between">

              <div>
                <p className="text-sm font-medium line-clamp-2">
                  {item.product_name}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  {t.quantity}: {item.quantity}
                </p>
              </div>

              <div className="flex justify-between items-end mt-2">

                <span
                  className={`text-xs px-2 py-1 rounded-full ${getColor(
                    item.status
                  )}`}
                >
                  {getStatusLabel(item.status)}
                </span>

                {item.created_at && (
                  <span className="text-[10px] text-gray-400">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                )}

              </div>
            </div>
          </div>
        ))}

      </div>
    </main>
  );
}
