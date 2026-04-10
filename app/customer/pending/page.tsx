"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";

/* ================= TYPES ================= */

interface OrderItem {
  product_name: string;
  thumbnail: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
}

interface Order {
  id: string;
  order_number: string;
  total: number;
  created_at: string;
  status: string;
  order_items: OrderItem[];
}

interface MessageState {
  type: "error" | "success";
  text: string;
}

/* ================= FETCHER ================= */

const fetcher = async (url: string) => {
  const token = await getPiAccessToken();
  if (!token) return [];

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.orders ?? [];
};

/* ================= PAGE ================= */

export default function PendingOrdersPage() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showCancelFor, setShowCancelFor] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [message, setMessage] = useState<MessageState | null>(null);

  function showMessage(text: string, type: "error" | "success" = "error") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }

  function resetCancelState() {
    setShowCancelFor(null);
    setSelectedReason("");
    setCustomReason("");
  }

  /* ================= SWR ================= */

  const {
    data: allOrders = [],
    isLoading,
    mutate,
  } = useSWR(user ? "/api/orders" : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    keepPreviousData: true,
  });

  const orders = useMemo(
    () => allOrders.filter((o: Order) => o.status === "pending"),
    [allOrders]
  );

  const totalPi = useMemo(
    () => orders.reduce((sum, o) => sum + Number(o.total || 0), 0),
    [orders]
  );

  /* ================= CANCEL ================= */

  async function handleCancel(orderId: string, reason: string) {
    try {
      setProcessingId(orderId);

      const token = await getPiAccessToken();
      if (!token) {
        showMessage("Login required");
        return;
      }

      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cancel_reason: reason }),
      });

      if (!res.ok) throw new Error();

      // 🚀 update UI ngay không cần reload
      mutate(
        (prev: Order[] = []) =>
          prev.filter((o) => o.id !== orderId),
        false
      );

      resetCancelState();
      showMessage(t.cancel_success || "Huỷ thành công", "success");

    } catch {
      showMessage(t.cancel_order_failed || "Huỷ thất bại", "error");
    } finally {
      setProcessingId(null);
    }
  }

  /* ================= UI ================= */

  if (authLoading) {
    return <main className="p-8 text-center">Loading...</main>;
  }

  if (!user) {
    return <main className="p-8 text-center">Please login</main>;
  }

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* MESSAGE */}
      {message && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 px-4 py-2 text-white rounded ${
          message.type === "error" ? "bg-red-500" : "bg-green-500"
        }`}>
          {message.text}
        </div>
      )}

      {/* HEADER */}
      <header className="bg-orange-500 px-4 py-4 text-white">
        <div className="bg-orange-400 rounded-lg p-4">
          <p>{t.order_info}</p>
          <p className="text-xs mt-1">
            {orders.length} · π{formatPi(totalPi)}
          </p>
        </div>
      </header>

      {/* CONTENT */}
      <section className="mt-6 px-4">

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-20 bg-gray-200 rounded" />
            <div className="h-20 bg-gray-200 rounded" />
          </div>

        ) : orders.length === 0 ? (
          <p className="text-center text-gray-400 mt-10">
            {t.no_pending_orders}
          </p>

        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <div key={o.id} className="bg-white rounded-xl shadow-sm">

                {/* HEADER */}
                <div className="flex justify-between px-4 py-3 border-b">
                  <span>#{o.order_number}</span>
                  <span className="text-orange-500">
                    {t.status_pending}
                  </span>
                </div>

                {/* PRODUCTS */}
                {o.order_items?.map((item, i) => (
                  <div key={i} className="flex gap-3 p-4 border-b">
                    <img
                      src={item.thumbnail || "/placeholder.png"}
                      className="w-14 h-14 rounded object-cover"
                    />

                    <div className="flex-1">
                      <p className="text-sm">{item.product_name}</p>
                      <p className="text-xs text-gray-500">
                        x{item.quantity} · π{formatPi(item.unit_price)}
                      </p>
                    </div>
                  </div>
                ))}

                {/* FOOTER */}
                <div className="flex justify-between px-4 py-3">
                  <span>
                    π{formatPi(o.total)}
                  </span>

                  <button
                    onClick={() => setShowCancelFor(o.id)}
                    disabled={processingId === o.id}
                    className="border border-red-500 text-red-500 px-3 py-1 rounded"
                  >
                    {processingId === o.id ? "..." : t.cancel_order}
                  </button>
                </div>

                {/* CANCEL */}
                {showCancelFor === o.id && (
                  <div className="p-4 space-y-2">

                    <input
                      placeholder="Reason..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="border p-2 w-full rounded"
                    />

                    <button
                      onClick={() => handleCancel(o.id, customReason)}
                      className="bg-red-500 text-white px-4 py-2 rounded"
                    >
                      Confirm
                    </button>

                  </div>
                )}

              </div>
            ))}
          </div>
        )}

      </section>
    </main>
  );
}
