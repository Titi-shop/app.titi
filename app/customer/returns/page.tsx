"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";

/* ================= TYPES ================= */

type ReturnRecord = {
  id: string;
  return_number: string;
  order_id: string;
  status: string;
  refund_amount: string;
  currency: string;
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
    if (authLoading) return;
    if (!user) return;

    void loadReturns();
  }, [authLoading, user]);

  async function loadReturns() {
    try {
      const token = await getPiAccessToken();

      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/returns", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        console.error("❌ Load returns failed:", res.status);
        setReturns([]);
        return;
      }

      const data = await res.json();

      console.log("📦 RETURNS DATA:", data);

      setReturns(data.items ?? []);
    } catch (err) {
      console.error("❌ Load returns error:", err);
      setReturns([]);
    } finally {
      setLoading(false);
    }
  }

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
        return "bg-green-100 text-green-700";
      case "rejected":
        return "bg-red-100 text-red-600";
      case "cancelled":
        return "bg-gray-200 text-gray-600";
      default:
        return "bg-gray-100 text-gray-500";
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case "pending":
        return t.return_pending ?? "Pending";
      case "approved":
        return t.return_approved ?? "Approved";
      case "shipping_back":
        return t.return_shipping ?? "Returning";
      case "received":
        return t.return_received ?? "Received";
      case "refunded":
        return t.return_refunded ?? "Refunded";
      case "rejected":
        return t.return_rejected ?? "Rejected";
      case "cancelled":
        return t.return_cancelled ?? "Cancelled";
      default:
        return status;
    }
  }

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-20 bg-gray-100 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-xl mx-auto p-4 space-y-4">

        {/* HEADER */}
        <h1 className="text-lg font-semibold">
          {t.my_returns ?? "My Returns"}
        </h1>

        {/* EMPTY */}
        {returns.length === 0 && (
          <div className="bg-white p-6 rounded-xl text-center text-gray-500 shadow-sm">
            📦 {t.no_returns ?? "No return requests yet"}
          </div>
        )}

        {/* LIST */}
        {returns.map((r) => (
          <div
            key={r.id}
            onClick={() =>
              router.push(`/customer/returns/${r.id}`)
            }
            className="bg-white rounded-xl shadow-sm p-4 space-y-3 cursor-pointer active:scale-[0.98] transition"
          >

            {/* TOP */}
            <div className="flex justify-between items-center">

              <div>
                <p className="text-sm font-semibold">
                  #{r.return_number || r.id.slice(0, 8)}
                </p>

                <p className="text-xs text-gray-400">
                  {t.order ?? "Order"}: {r.order_id.slice(0, 8)}
                </p>
              </div>

              <span
                className={`px-2 py-1 text-[11px] rounded-full ${getStatusColor(
                  r.status
                )}`}
              >
                {getStatusText(r.status)}
              </span>
            </div>

            {/* AMOUNT */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">
                {t.refund_amount ?? "Refund"}
              </span>

              <span className="font-semibold text-orange-600">
                π{Number(r.refund_amount || 0)}
              </span>
            </div>

            {/* TIMELINE */}
            <div className="flex items-center text-[10px] text-gray-400 gap-1">
              <span>Pending</span>
              <span>→</span>
              <span>Approved</span>
              <span>→</span>
              <span>Returning</span>
              <span>→</span>
              <span>Refunded</span>
            </div>

            {/* TRACKING */}
            {r.return_tracking_code && (
              <div className="text-xs text-blue-600">
                🚚 {t.tracking ?? "Tracking"}:{" "}
                {r.return_tracking_code}
              </div>
            )}

            {/* REFUNDED */}
            {r.refunded_at && (
              <div className="text-xs text-green-600">
                💰 {t.refunded_at ?? "Refunded"}:{" "}
                {new Date(r.refunded_at).toLocaleString()}
              </div>
            )}

            {/* TIME */}
            <div className="text-[10px] text-gray-400">
              {new Date(r.created_at).toLocaleString()}
            </div>
          </div>
        ))}

      </div>
    </main>
  );
}
