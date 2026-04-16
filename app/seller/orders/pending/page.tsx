"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
import useSWR from "swr";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";
import { useAuth } from "@/context/AuthContext"
import OrderCard from "@/components/OrderCard";
import OrderActions from "@/components/OrderActions";
/* ================= TYPES ================= */
type RawOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number | string;
  created_at: string;

  shipping_name?: string;
  shipping_phone?: string;

  shipping_address_line?: string;
  shipping_ward?: string | null;
  shipping_district?: string | null;
  shipping_region?: string | null;

  shipping_provider?: string | null;
  shipping_country?: string | null;
  shipping_postal_code?: string | null;

  order_items?: RawOrderItem[];
};

type RawOrderItem = {
  id: string;
  product_id?: string | null;
  product_name?: string;
  thumbnail?: string;
  images?: string[];
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  status?: string;
};
interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  thumbnail: string;
  images: string[] | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
}

type OrderStatus = "pending" | "confirmed" | "cancelled";

interface Order {
  id: string;
  order_number: string;

  status: OrderStatus;

  total: number;
  created_at: string;

  shipping_name: string;
  shipping_phone: string;
  shipping_address_line: string;
  shipping_ward?: string | null;
  shipping_district?: string | null;
  shipping_region?: string | null;
  shipping_provider?: string | null;
  shipping_country?: string | null;
shipping_postal_code?: string | null;

  order_items: OrderItem[];
}

/* ================= HELPERS ================= */



function formatDate(date: string): string {
  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return "—";
  }

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
const fetcher = async (): Promise<Order[]> => {
  try {
    const res = await apiAuthFetch(
      "/api/seller/orders?status=pending",
      { cache: "no-store" }
    );

    if (!res.ok) return [];

    const data: unknown = await res.json();

    if (!Array.isArray(data)) return [];

    return data.map((o) => {
      const order = o as RawOrder;

      return {
        id: order.id,
        order_number: order.order_number,
        status: order.status,

        total: Number(order.total ?? 0),
        created_at: order.created_at,

        shipping_name: order.shipping_name ?? "",
        shipping_phone: order.shipping_phone ?? "",

        shipping_address_line: order.shipping_address_line ?? "",
        shipping_ward: order.shipping_ward ?? null,
        shipping_district: order.shipping_district ?? null,
        shipping_region: order.shipping_region ?? null,

        shipping_provider: order.shipping_provider ?? null,
        shipping_country: order.shipping_country ?? null,
        shipping_postal_code: order.shipping_postal_code ?? null,

        order_items: (order.order_items ?? []).map((i) => ({
          id: i.id,
          product_id: i.product_id ?? null,
          product_name: i.product_name ?? "",
          thumbnail: i.thumbnail ?? "",
          images: i.images ?? [],
          quantity: Number(i.quantity ?? 0),
          unit_price: Number(i.unit_price ?? 0),
          total_price: Number(i.total_price ?? 0),
          status: i.status ?? "pending",
        })),
      };
    });
  } catch {
    return [];
  }
};
/* ================= PAGE ================= */

export default function SellerPendingOrdersPage() {
  const router = useRouter();
  const { t } = useTranslation();
const { user, loading: authLoading } = useAuth();
  const {
  data: orders = [],
  isLoading,
  mutate,
} = useSWR(
  !authLoading && user
    ? "/api/seller/orders?status=pending"
    : null,
  fetcher
);
  const SELLER_CANCEL_REASONS: string[] = [
    t.cancel_reason_out_of_stock ?? "Out of stock",
    t.cancel_reason_discontinued ?? "Product discontinued",
    t.cancel_reason_wrong_price ?? "Wrong price",
    t.cancel_reason_other ?? "Other",
  ];

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showConfirmFor, setShowConfirmFor] = useState<string | null>(null);
  const [sellerMessage, setSellerMessage] = useState<string>("");
  const [showCancelFor, setShowCancelFor] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");

  const totalPi = useMemo(
  () =>
    orders.reduce(
      (sum, o) => sum + Number(o.total ?? 0),
      0
    ),
  [orders]
);

  /* ================= CONFIRM ================= */

  async function handleConfirm(orderId: string): Promise<void> {
  if (!sellerMessage.trim()) return;

  try {
    setProcessingId(orderId);

    const previous = orders;

    // 🚀 optimistic: xoá ngay khỏi UI
    await mutate(
      orders.filter((o) => o.id !== orderId),
      false
    );

    const res = await apiAuthFetch(
      `/api/seller/orders/${orderId}/confirm`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_message: sellerMessage,
        }),
      }
    );

    if (!res.ok) {
      // 🔴 rollback nếu fail
      await mutate(previous, false);
      return;
    }

    setShowConfirmFor(null);
    setSellerMessage("");

    mutate(); // sync lại server
  } catch {
    mutate(); // fallback
  } finally {
    setProcessingId(null);
  }
}

  /* ================= CANCEL ================= */

  async function handleCancel(orderId: string): Promise<void> {
  const finalReason =
    selectedReason === (t.cancel_reason_other ?? "Other")
      ? customReason
      : selectedReason;

  if (!finalReason.trim()) return;

  try {
    setProcessingId(orderId);

    const previous = orders;

    // 🚀 optimistic remove
    await mutate(
      orders.filter((o) => o.id !== orderId),
      false
    );

    const res = await apiAuthFetch(
      `/api/seller/orders/${orderId}/cancel`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancel_reason: finalReason,
        }),
      }
    );

    if (!res.ok) {
      // 🔴 rollback
      await mutate(previous, false);
      return;
    }

    setShowCancelFor(null);
    setSelectedReason("");
    setCustomReason("");

    mutate();
  } catch {
    mutate();
  } finally {
    setProcessingId(null);
  }
}

  /* ================= LOADING ================= */

 if (isLoading || authLoading) {
    return (
      <p className="text-center mt-10 text-gray-400">
        {t.loading ?? "Đang tải..."}
      </p>
    );
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">
      {/* HEADER */}
      <header className="bg-gray-600 text-white px-4 py-4">
        <div className="bg-gray-500 rounded-lg p-4">
          <p className="text-sm opacity-90">
            {t.pending_orders ?? "Đơn chờ xác nhận"}
          </p>
          <p className="text-xs opacity-80 mt-1">
            {t.orders ?? "Đơn hàng"}: {orders.length} · π
            {formatPi(totalPi)}
          </p>
        </div>
      </header>

      <section className="mt-6 px-4 space-y-4">
        {orders.length === 0 ? (
          <p className="text-center text-gray-400">
            {t.no_pending_orders ?? "Không có đơn chờ"}
          </p>
        ) : (
          orders.map((o) => (
  <OrderCard
    key={o.id}
    order={{
      id: o.id,
      order_number: o.order_number,
      created_at: o.created_at,
      status: o.status,
      shipping_name: o.shipping_name,
      total: o.total,
      order_items: o.order_items.map((i) => ({
        id: i.id,
        product_name: i.product_name,
        thumbnail: i.thumbnail,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    }}
    onClick={() => router.push(`/seller/orders/${o.id}`)}
    actions={
      <OrderActions
        status={o.status}
        orderId={o.id}
        loading={processingId === o.id}
        onDetail={() => router.push(`/seller/orders/${o.id}`)}
        onConfirm={() => {
          setSellerMessage(
            t.confirm_default_message ?? "Thank you for your order."
          );
          setShowConfirmFor(o.id);
          setShowCancelFor(null);
        }}
        onCancel={() => {
          setShowCancelFor(o.id);
          setShowConfirmFor(null);
        }}
      />
    }
  />
))
        )}
      </section>
    </main>
  );
}
