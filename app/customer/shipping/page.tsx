"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";
import { useAuth } from "@/context/AuthContext";

/* ================= TYPES ================= */

type OrderStatus =
  | "pending"
  | "pickup"
  | "shipping"
  | "completed"
  | "cancelled";

interface OrderItem {
  product_name: string;
  thumbnail: string;
  images?: string[];
  quantity: number;
  unit_price: number;
  total_price: number;
  seller_message?: string | null;
  seller_cancel_reason?: string | null;
}

interface Order {
  id: string;
  order_number: string;
  total: number;
  status: OrderStatus;
  order_items: OrderItem[];
}

/* ================= FETCHER ================= */

const fetcher = async (url: string) => {
  const token = await getPiAccessToken();
  if (!token) return [];

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.orders ?? [];
};

/* ================= PAGE ================= */

export default function ShippingOrdersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [processingId, setProcessingId] = useState<string | null>(null);

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

  /* ================= FILTER ================= */

  const orders = useMemo(
    () =>
      allOrders.filter(
        (o: Order) => o.status === "shipping"
      ),
    [allOrders]
  );

  const totalPi = useMemo(
    () =>
      orders.reduce(
        (sum, o) => sum + Number(o.total),
        0
      ),
    [orders]
  );

  /* ================= CONFIRM RECEIVED ================= */

  async function handleConfirmReceived(orderId: string) {
    try {
      setProcessingId(orderId);

      const token = await getPiAccessToken();
      if (!token) return;

      const res = await fetch(`/api/orders/${orderId}/complete`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("UPDATE_FAILED");
      }

      // ✅ update UI ngay (không reload)
      mutate(
        (prev: Order[] = []) =>
          prev.filter((o) => o.id !== orderId),
        false
      );

      router.push("/customer/completed");

    } catch (err) {
      console.error("Confirm received error:", err);
      alert(t.confirm_failed);
    } finally {
      setProcessingId(null);
    }
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <header className="bg-orange-500 text-white px-4 py-4">
        <div className="bg-orange-400 rounded-lg p-4">
          <p className="text-sm opacity-90">
            {t.order_info}
          </p>

          <p className="text-xs opacity-80 mt-1">
            {t.orders}: {orders.length} · π{formatPi(totalPi)}
          </p>
        </div>
      </header>

      {/* CONTENT */}
      <section className="mt-6 px-4">

        {isLoading || authLoading ? (

          <p className="text-center text-gray-400">
            {t.loading_orders}
          </p>

        ) : orders.length === 0 ? (

          <div className="flex flex-col items-center justify-center mt-16 text-gray-400">
            <div className="w-24 h-24 bg-gray-200 rounded-full mb-4 opacity-40" />
            <p>{t.no_shipping_orders}</p>
          </div>

        ) : (

          <div className="space-y-4">

            {orders.map((o) => (

              <div
                key={o.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden"
              >

                {/* HEADER */}
                <div className="flex justify-between items-start px-4 py-3 border-b">

                  <span className="font-semibold text-xs break-all max-w-[60%]">
                    #{o.order_number}
                  </span>

                  <span className="text-orange-500 text-xs text-right max-w-[120px] line-clamp-2">
                    {t.status_shipping}
                  </span>

                </div>

                {/* PRODUCTS */}
                <div className="px-4 py-3 space-y-3">

                  {o.order_items.map((item, idx) => (

                    <div
                      key={idx}
                      className="flex gap-3 items-center min-h-[70px]"
                    >

                      <div className="w-14 h-14 bg-gray-100 rounded overflow-hidden">
                        <img
                          src={item.thumbnail || "/placeholder.png"}
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>

                      <div className="flex-1 min-w-0">

                        <p className="text-sm font-medium line-clamp-2 min-h-[40px]">
                          {item.product_name}
                        </p>

                        <p className="text-xs text-gray-500">
                          x{item.quantity} · π
                          {formatPi(
                            Number(item.total_price) /
                            Number(item.quantity || 1)
                          )}
                        </p>

                        {item.seller_message && (
                          <p className="text-xs text-blue-600 mt-1">
                            {t.seller_message}: {item.seller_message}
                          </p>
                        )}

                        {item.seller_cancel_reason && (
                          <p className="text-xs text-red-500 mt-1">
                            {t.seller_cancel_reason}: {item.seller_cancel_reason}
                          </p>
                        )}

                      </div>

                    </div>

                  ))}

                </div>

                {/* FOOTER */}
                <div className="flex justify-between items-center px-4 py-3 border-t">

                  <p className="text-sm font-semibold">
                    {t.total}: π{formatPi(o.total)}
                  </p>

                  <button
                    onClick={() => handleConfirmReceived(o.id)}
                    disabled={processingId === o.id}
                    className="px-4 py-1.5 text-sm border border-orange-500 text-orange-500 rounded-md hover:bg-orange-500 hover:text-white transition disabled:opacity-50"
                  >
                    {processingId === o.id
                      ? t.processing
                      : t.received}
                  </button>

                </div>

              </div>

            ))}

          </div>

        )}

      </section>

    </main>
  );
}
