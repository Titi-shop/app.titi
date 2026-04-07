"use client";

import { useState } from "react";
import { getPiAccessToken } from "@/lib/piAuth";

type PendingPayment = {
  paymentId: string;
  amount?: number;
};

export default function ClearPendingPage() {
  const [paymentId, setPaymentId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [payments, setPayments] = useState<PendingPayment[]>([]);

  /* ================= CANCEL ================= */

  const handleCancel = async (id?: string) => {
    const targetId = id || paymentId;

    if (!targetId.trim()) {
      alert("⚠️ Vui lòng nhập paymentId!");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const token = await getPiAccessToken();

      const res = await fetch("/api/pi/cancel", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentId: targetId.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setMessage(`❌ Lỗi: ${data?.error || "CANCEL_FAILED"}`);
        return;
      }

      setMessage("✅ Đã huỷ thành công");

      // remove khỏi list nếu có
      setPayments((prev) =>
        prev.filter((p) => p.paymentId !== targetId)
      );

      setPaymentId("");
    } catch (err: unknown) {
      const error = err as Error;
      setMessage(`💥 Lỗi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /* ================= LIST ================= */

  const handleListPending = async () => {
    setListLoading(true);
    setMessage("");

    try {
      const token = await getPiAccessToken();

      const res = await fetch("/api/pi/list-pending", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(`❌ Lỗi: ${data?.error || "FETCH_FAILED"}`);
        return;
      }

      setPayments(data.payments || []);
    } catch (err: unknown) {
      const error = err as Error;
      setMessage(`💥 Lỗi: ${error.message}`);
    } finally {
      setListLoading(false);
    }
  };

  /* ================= UI ================= */

  return (
    <main className="max-w-md mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 className="text-xl font-bold text-center text-gray-800 mb-4">
        🧹 Huỷ giao dịch Pi đang pending
      </h1>

      <p className="text-gray-600 text-sm mb-4">
        Nếu bạn bị lỗi <strong>"A pending payment needs to be handled"</strong>,
        hãy lấy <code>paymentId</code> bên dưới hoặc dán vào ô để huỷ.
      </p>

      {/* INPUT */}
      <input
        type="text"
        placeholder="Nhập paymentId..."
        value={paymentId}
        onChange={(e) => setPaymentId(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:ring-2 focus:ring-orange-500 outline-none"
      />

      {/* CANCEL BUTTON */}
      <button
        onClick={() => handleCancel()}
        disabled={loading}
        className={`w-full py-3 rounded-lg text-white font-semibold ${
          loading
            ? "bg-gray-400"
            : "bg-orange-600 hover:bg-orange-700 active:bg-orange-800"
        }`}
      >
        {loading ? "Đang huỷ..." : "Huỷ giao dịch"}
      </button>

      {/* LIST BUTTON */}
      <button
        onClick={handleListPending}
        disabled={listLoading}
        className="w-full mt-3 py-3 rounded-lg bg-gray-700 text-white font-semibold hover:bg-gray-800"
      >
        {listLoading ? "Đang tải..." : "📋 Xem danh sách pending"}
      </button>

      {/* MESSAGE */}
      {message && (
        <div className="mt-4 p-3 border rounded bg-white text-sm text-gray-700">
          {message}
        </div>
      )}

      {/* LIST RESULT */}
      {payments.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="font-semibold text-gray-800">
            Danh sách pending:
          </h2>

          {payments.map((p) => (
            <div
              key={p.paymentId}
              className="border rounded-lg p-3 bg-white flex justify-between items-center"
            >
              <div className="text-xs break-all">
                <div className="font-semibold">{p.paymentId}</div>
                {p.amount && <div>{p.amount} π</div>}
              </div>

              <button
                onClick={() => handleCancel(p.paymentId)}
                className="ml-2 px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
              >
                Huỷ
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
