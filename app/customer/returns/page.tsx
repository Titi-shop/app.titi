"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

/* ================= TYPES ================= */

type ReturnRecord = {
  id: string;
  return_number?: string;
  order_id: string;
  status: string;
  refund_amount?: string;
  created_at: string;
  return_tracking_code?: string | null;
  refunded_at?: string | null;
};

/* ================= PAGE ================= */

export default function ReturnsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);

  /* ================= LOAD ================= */

  useEffect(() => {
    if (authLoading || !user) return;

    async function load() {
      try {
        const res = await apiAuthFetch("/api/returns");

        if (!res.ok) {
          console.error("❌ RETURNS API ERROR:", res.status);
          return;
        }

        const data = await res.json();

        console.log("📦 RETURNS RAW:", data);

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.items)
          ? data.items
          : [];

        setReturns(list);
      } catch (err) {
        console.error("💥 Load returns error:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [authLoading, user]);

  /* ================= STATUS ================= */

  function getStatusColor(status: string) {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700";

      case "approved":
        return "bg-blue-100 text-blue-700";

      case "shipping_back":
        return "bg-indigo-100 text-indigo-700";

      case "received":
        return "bg-purple-100 text-purple-700";

      case "refunded":
        return "bg-green-200 text-green-800";

      case "rejected":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case "pending":
        return t.return_pending ?? "Pending";

      case "approved":
        return t.return_approved ?? "Approved";

      case "shipping_back":
        return t.return_shipping ?? "Return Shipping";

      case "received":
        return t.return_received ?? "Received";

      case "refunded":
        return t.return_refunded ?? "Refunded";

      case "rejected":
        return t.return_rejected ?? "Rejected";

      default:
        return status;
    }
  }

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div className="p-6 text-center">
        {t.loading ?? "Loading..."}
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-xl mx-auto p-4 space-y-4">

        <h1 className="text-lg font-semibold">
          {t.my_returns ?? "My Returns"}
        </h1>

        {returns.length === 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm text-center text-gray-500">
            {t.no_returns ?? "No return requests yet"}
          </div>
        )}

        {returns.map((r) => {
          if (!r || !r.id) return null;

          return (
            <div
              key={r.id}
              onClick={() =>
                router.push(`/customer/returns/${r.id}`)
              }
              className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition space-y-3"
            >
              {/* HEADER */}
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">
                    #{r.return_number ?? r.id.slice(0, 8)}
                  </p>

                  <p className="text-xs text-gray-400">
                    {t.order ?? "Order"}:{" "}
                    {r.order_id?.slice(0, 8) ?? "N/A"}
                  </p>
                </div>

                <span
                  className={`px-3 py-1 text-xs rounded-full ${getStatusColor(
                    r.status
                  )}`}
                >
                  {getStatusText(r.status)}
                </span>
              </div>

              {/* TIMELINE */}
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <span>Pending</span>
                <span>→</span>
                <span>Approved</span>
                <span>→</span>
                <span>Shipping</span>
                <span>→</span>
                <span>Refunded</span>
              </div>

              {/* TRACKING */}
              {r.return_tracking_code && (
                <div className="text-xs text-blue-600">
                  {t.tracking ?? "Tracking"}:{" "}
                  {r.return_tracking_code}
                </div>
              )}

              {/* REFUND */}
              {r.refunded_at && (
                <div className="text-xs text-green-600">
                  {t.refunded_at ?? "Refunded at"}:{" "}
                  {new Date(r.refunded_at).toLocaleString()}
                </div>
              )}
            </div>
          );
        })}

      </div>
    </main>
  );
}
