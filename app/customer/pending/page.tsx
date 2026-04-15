"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

  seller_message?: string | null;
  seller_cancel_reason?: string | null;

  order_items: OrderItem[];
}

interface MessageState {
  type: "error" | "success";
  text: string;
}

/* ================= CANCEL KEYS ================= */

const CANCEL_REASON_KEYS = [
  "cancel_reason_change_mind",
  "cancel_reason_wrong_product",
  "cancel_reason_change_variant",
  "cancel_reason_better_price",
  "cancel_reason_delivery_slow",
  "cancel_reason_update_address",
  "cancel_reason_other",
] as const;

/* ================= FETCHER ================= */

const fetcher = async (url: string): Promise<Order[]> => {
  try {
    const token = await getPiAccessToken();
    if (!token) return [];

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) return [];

    const data = await res.json();

    // 🔥 hỗ trợ cả 2 dạng API
    const list = Array.isArray(data) ? data : data.orders;

    if (!Array.isArray(list)) return [];

    return list.map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      total: Number(o.total ?? 0),
      created_at: o.created_at,

      seller_message: o.seller_message ?? null,
      seller_cancel_reason: o.seller_cancel_reason ?? null,

      order_items: (o.order_items || []).map((i: any) => ({
        product_name: i.product_name ?? "",
        thumbnail: i.thumbnail ?? "",
        quantity: Number(i.quantity ?? 0),
        unit_price: Number(i.unit_price ?? 0),
        total_price: Number(i.total_price ?? 0),
        status: i.status ?? "pending",
      })),
    }));
  } catch (err) {
    console.error("FETCH ERROR", err);
    return [];
  }
};

/* ================= PAGE ================= */

export default function PendingOrdersPage() {
  const router = useRouter();
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
  } = useSWR(user ? "/api/orders" : null, fetcher);

  const orders = useMemo(
    () => allOrders.filter((o) => o.status === "pending"),
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
      if (!token) return;

      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cancel_reason: reason }),
      });

      if (!res.ok) throw new Error();

      mutate(
        (prev: Order[] = []) =>
          prev.filter((o) => o.id !== orderId),
        false
      );

      resetCancelState();
      showMessage("Huỷ đơn thành công", "success");

    } catch {
      showMessage("Huỷ đơn thất bại");
    } finally {
      setProcessingId(null);
    }
  }

  /* ================= UI ================= */

  if (authLoading) {
    return <p className="text-center mt-10">Loading...</p>;
  }

  if (!user) {
    return <p className="text-center mt-10">Login required</p>;
  }

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* MESSAGE */}
      {message && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded">
          {message.text}
        </div>
      )}

      {/* HEADER */}
      <header className="bg-orange-500 p-4 text-white">
        <p>Đơn chờ xác nhận</p>
        <p className="text-xs mt-1">
          {orders.length} đơn · π{formatPi(totalPi)}
        </p>
      </header>

      {/* LIST */}
      <section className="p-4 space-y-4">

        {orders.map((o) => (
          <div key={o.id} className="bg-white rounded-xl shadow">

            {/* HEADER */}
            <div className="flex justify-between px-4 py-3 border-b">
              <span className="font-semibold">
                #{o.order_number}
              </span>
              <span className="text-orange-500 text-sm">
                Chờ xác nhận
              </span>
            </div>

            {/* PRODUCTS */}
            <div className="p-4 space-y-3">
              {o.order_items.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <img
                    src={item.thumbnail || "/placeholder.png"}
                    className="w-16 h-16 rounded object-cover"
                  />

                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {item.product_name}
                    </p>

                    <p className="text-xs text-gray-500">
                      x{item.quantity} · π{formatPi(item.unit_price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* SELLER MESSAGE */}
            {o.seller_message && (
              <div className="px-4 pb-2 text-xs text-green-600">
                ✔ {o.seller_message}
              </div>
            )}

            {o.seller_cancel_reason && (
              <div className="px-4 pb-2 text-xs text-red-500">
                ✖ {o.seller_cancel_reason}
              </div>
            )}

            {/* FOOTER */}
            <div className="flex justify-between px-4 py-3 border-t">
              <span className="font-semibold">
                π{formatPi(o.total)}
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/orders/${o.id}`)}
                  className="border px-3 py-1 text-xs rounded"
                >
                  Chi tiết
                </button>

                <button
                  onClick={() => setShowCancelFor(o.id)}
                  className="border border-red-500 text-red-500 px-3 py-1 text-xs rounded"
                >
                  Huỷ
                </button>
              </div>
            </div>

            {/* CANCEL BOX */}
            {showCancelFor === o.id && (
              <div className="p-4 space-y-2">
                {CANCEL_REASON_KEYS.map((key) => (
                  <label key={key} className="flex gap-2 text-sm">
                    <input
                      type="radio"
                      onChange={() => setSelectedReason(key)}
                    />
                    {t[key] || key}
                  </label>
                ))}

                <button
                  onClick={() =>
                    handleCancel(o.id, selectedReason)
                  }
                  className="bg-red-500 text-white px-3 py-1 rounded"
                >
                  Xác nhận huỷ
                </button>
              </div>
            )}

          </div>
        ))}

      </section>
    </main>
  );
}
