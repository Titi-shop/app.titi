"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { formatPi } from "@/lib/pi";

import OrdersList from "@/components/OrdersList";
import OrderActions from "@/components/OrderActions";

/* ================= TYPES ================= */

type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "returned"
  | "cancelled";

interface RawOrderItem {
  id: string;
  product_name?: string;
  thumbnail?: string;
  quantity?: number;
  unit_price?: number;
  status?: string;
}

interface RawOrder {
  id: string;
  order_number: string;
  total: number | string;
  created_at: string;
  shipping_name?: string;
  shipping_phone?: string;
  order_items?: RawOrderItem[];
}

interface OrderItem {
  id: string;
  product_name: string;
  thumbnail: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  shipping_name: string;
  shipping_phone: string;
  order_items: OrderItem[];
}

/* ================= FETCHER ================= */

const fetcher = async (): Promise<Order[]> => {
  try {
    const res = await apiAuthFetch("/api/seller/orders", {
      cache: "no-store",
    });

    if (!res.ok) return [];

    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((o) => {
      const order = o as RawOrder;

      const itemStatuses = (order.order_items ?? []).map((i) =>
        String(i.status ?? "").toLowerCase().trim()
      );

      let status: OrderStatus = "pending";

      if (itemStatuses.includes("shipping")) status = "shipping";
      else if (itemStatuses.includes("completed")) status = "completed";
      else if (itemStatuses.includes("returned")) status = "returned";
      else if (itemStatuses.includes("confirmed")) status = "confirmed";
      else if (itemStatuses.includes("cancelled")) status = "cancelled";

      return {
        id: order.id,
        order_number: order.order_number,
        status,
        total: Number(order.total ?? 0),
        created_at: order.created_at,
        shipping_name: order.shipping_name ?? "",
        shipping_phone: order.shipping_phone ?? "",
        order_items: (order.order_items ?? []).map((i) => ({
          id: i.id,
          product_name: i.product_name ?? "",
          thumbnail: i.thumbnail ?? "",
          quantity: Number(i.quantity ?? 0),
          unit_price: Number(i.unit_price ?? 0),
        })),
      };
    });
  } catch {
    return [];
  }
};

/* ================= PAGE ================= */

export default function SellerConfirmedOrdersPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const { data: orders = [], isLoading, mutate } = useSWR(
    !authLoading && user ? "/api/seller/orders" : null,
    fetcher
  );

  /* ================= STATE ================= */

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  /* ================= TOTAL ================= */

  const totalPi = useMemo(
    () => orders.reduce((s, o) => s + o.total, 0),
    [orders]
  );

  /* ================= ACTION ================= */

  async function startShipping(orderId: string) {
    try {
      setProcessingId(orderId);

      const res = await apiAuthFetch(
        `/api/seller/orders/${orderId}/shipping`,
        { method: "PATCH" }
      );

      if (!res.ok) return;

      mutate();
    } finally {
      setProcessingId(null);
    }
  }

  /* ================= LOADING ================= */

  if (isLoading || authLoading) {
    return (
      <p className="text-center mt-10 text-gray-400">
        {t.loading ?? "Loading..."}
      </p>
    );
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <header className="bg-gray-600 text-white px-4 py-4">
        <div className="bg-gray-500 rounded-lg p-4">
          <p>{t.confirmed_orders ?? "Confirmed orders"}</p>
          <p className="text-xs">
            {orders.filter(o => o.status === "confirmed").length}
            {" "}· π{formatPi(totalPi)}
          </p>
        </div>
      </header>

      {/* LIST */}
      <OrdersList
        orders={orders}
        onClick={() => {}}
        initialTab="confirmed"

        renderActions={(o) => (
          <OrderActions
            status={o.status}
            orderId={o.id}
            loading={processingId === o.id}
            onDetail={() =>
              router.push(`/seller/orders/${o.id}`)
            }

            // ✅ SHIPPING BUTTON
            onShipping={() => {
              setConfirmId(o.id);
            }}
          />
        )}

        renderExtra={(o) => (
          <>
            {/* ✅ MODAL CHO ĐÚNG ORDER */}
            {confirmId === o.id && (
              <div className="bg-white p-3 rounded-lg border mt-2">
                <p className="text-sm mb-3">
                  {t.confirm_shipping ?? "Confirm shipping?"}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmId(null)}
                    className="flex-1 border rounded py-1"
                  >
                    {t.cancel ?? "Cancel"}
                  </button>

                  <button
                    onClick={() => {
                      const id = confirmId;
                      setConfirmId(null);
                      if (id) startShipping(id);
                    }}
                    className="flex-1 bg-gray-800 text-white rounded py-1"
                  >
                    {t.ok ?? "OK"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      />

    </main>
  );
}
