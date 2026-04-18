"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { getPiAccessToken } from "@/lib/piAuth";
import { useAuth } from "@/context/AuthContext";

/* =========================
RETURN STATUS
========================= */

type ReturnStatus =
  | "pending"
  | "seller_reviewing"
  | "approved"
  | "shipping_back"
  | "received"
  | "refunded"
  | "rejected";

/* =========================
TYPES
========================= */

interface ReturnRecord {
  id: string;
  order_id: string;
  product_name: string;
  product_thumbnail: string | null;
  quantity: number;
  refund_amount: number;
  status: ReturnStatus;
  reason?: string;
  created_at: string;
}

/* =========================
PAGE
========================= */

export default function ReturnDetailPage() {
  const { t } = useTranslation();

  const router = useRouter();
  const params = useParams();

const returnId = Array.isArray(params?.id)
  ? params.id[0]
  : params?.id;
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<ReturnRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (!returnId) return;

    void loadReturn();
  }, [authLoading, user, returnId]);

  /* =========================
  LOAD RETURN
  ========================= */

  async function loadReturn(): Promise<void> {
  try {
    const token = await getPiAccessToken();

    if (!token) {
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/returns/${returnId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      setData(null);
      return;
    }

    const record: ReturnRecord = await res.json();

    setData(record);

  } catch {
    setData(null);
  } finally {
    setLoading(false);
  }
}

  /* =========================
  STATUS COLOR
  ========================= */

  function getStatusColor(status: ReturnStatus) {
    switch (status) {
      case "pending":
        return "text-yellow-600";

      case "seller_reviewing":
        return "text-blue-600";

      case "approved":
        return "text-green-600";

      case "shipping_back":
        return "text-indigo-600";

      case "received":
        return "text-purple-600";

      case "refunded":
        return "text-green-700";

      case "rejected":
        return "text-red-600";

      default:
        return "text-gray-500";
    }
  }

  /* =========================
  LOADING
  ========================= */

  if (loading) {
    return (
      <main className="p-4">
        <p>{t.loading ?? "Loading..."}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="p-4">
        <p className="text-red-500">
          {t.return_not_found ?? "Return not found"}
        </p>
      </main>
    );
  }

  /* =========================
  UI
  ========================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}

      <header className="bg-orange-500 text-white px-4 py-4">
        <div className="bg-orange-400 rounded-lg p-4">

          <p className="text-sm opacity-90">
            {t.return_detail ?? "Return Detail"}
          </p>

          <p className="text-xs opacity-80 mt-1">
            {t.order ?? "Order"}: #{data.order_id}
          </p>

        </div>
      </header>

      {/* CONTENT */}

      <section className="mt-6 px-4 space-y-4">

        {/* PRODUCT */}

        <div className="bg-white rounded-xl shadow-sm p-4 flex gap-3">

          <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden">

            <img
              src={data.product_thumbnail ?? "/placeholder.png"}
              alt={data.product_name}
              className="w-full h-full object-cover"
            />

          </div>

          <div className="flex-1">

            <p className="font-medium text-sm">
              {data.product_name}
            </p>

            <p className="text-xs text-gray-500">
              {t.quantity ?? "Quantity"}: {data.quantity}
            </p>

          </div>

        </div>

        {/* STATUS */}

        <div className="bg-white rounded-xl shadow-sm p-4 flex justify-between">

          <span className="text-sm">
            {t.status ?? "Status"}
          </span>

          <span className={`text-sm ${getStatusColor(data.status)}`}>
            {t[data.status as keyof typeof t] ?? data.status}
          </span>

        </div>

        {/* REFUND */}

        <div className="bg-white rounded-xl shadow-sm p-4 flex justify-between">

          <span className="text-sm">
            {t.refund_amount ?? "Refund"}
          </span>

          <span className="font-semibold">
            π{data.refund_amount}
          </span>

        </div>

        {/* REASON */}

        {data.reason && (

          <div className="bg-white rounded-xl shadow-sm p-4">

            <p className="text-sm font-medium mb-1">
              {t.return_reason ?? "Reason"}
            </p>

            <p className="text-sm text-gray-600">
              {data.reason}
            </p>

          </div>

        )}

        {/* DATE */}

        <div className="bg-white rounded-xl shadow-sm p-4 flex justify-between">

          <span className="text-sm">
            {t.created_at ?? "Created"}
          </span>

          <span className="text-xs text-gray-500">
            {new Date(data.created_at).toLocaleDateString()}
          </span>

        </div>

      </section>

    </main>
  );
}
