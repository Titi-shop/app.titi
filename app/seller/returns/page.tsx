"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useAuth } from "@/context/AuthContext";

/* ================= TYPES ================= */

type ReturnRecord = {
  id: string;
  return_number: string;
  order_id: string;
  status: string;
  created_at: string;
};

/* ================= PAGE ================= */

export default function SellerReturnsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [data, setData] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);

  /* ================= LOAD ================= */

  useEffect(() => {
    if (authLoading || !user) return;

    load();
  }, [authLoading, user]);

  async function load() {
    try {
      const res = await apiAuthFetch("/api/seller/returns");

      if (!res.ok) {
        console.error("❌ LOAD RETURNS FAIL");
        return;
      }

      const json = await res.json();

      const list = Array.isArray(json)
        ? json
        : json.items ?? [];

      console.log("📦 SELLER RETURNS:", list);

      setData(list);

    } catch (err) {
      console.error("💥 LOAD ERROR:", err);
    } finally {
      setLoading(false);
    }
  }

  /* ================= STATUS ================= */

  function getColor(status: string) {
    switch (status) {
      case "pending":
        return "text-yellow-600";

      case "approved":
        return "text-blue-600";

      case "shipping_back":
        return "text-indigo-600";

      case "received":
        return "text-purple-600";

      case "refunded":
        return "text-green-600";

      case "rejected":
        return "text-red-600";

      default:
        return "text-gray-500";
    }
  }

  /* ================= UI ================= */

  if (loading) {
    return <p className="p-4">Loading...</p>;
  }

  return (
    <main className="p-4 max-w-xl mx-auto space-y-4">

      <h1 className="text-lg font-bold">
        🔄 Seller Returns
      </h1>

      {data.length === 0 && (
        <div className="text-center text-gray-500 bg-white p-6 rounded-xl">
          No returns
        </div>
      )}

      {data.map((r) => (
        <div
          key={r.id}
          onClick={() =>
            router.push(`/seller/returns/${r.id}`)
          }
          className="bg-white p-4 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition"
        >
          <div className="flex justify-between">

            <div>
              <p className="text-sm font-semibold">
                #{r.return_number}
              </p>

              <p className="text-xs text-gray-400">
                Order: {r.order_id?.slice(0, 8)}
              </p>
            </div>

            <span className={`text-sm ${getColor(r.status)}`}>
              {r.status}
            </span>
          </div>

          <p className="text-xs text-gray-400 mt-2">
            {new Date(r.created_at).toLocaleString()}
          </p>

        </div>
      ))}

    </main>
  );
}
