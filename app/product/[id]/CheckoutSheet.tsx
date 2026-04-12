"use client";

import { formatPi } from "@/lib/pi";
import { useCheckout } from "./checkout.logic";

export default function CheckoutSheet({ open, onClose, product }: any) {
  const t = {}; // giữ nguyên của bạn

  const {
    item,
    quantity,
    qtyDraft,
    setQtyDraft,
    maxStock,
    zone,
    setZone,
    availableRegions,
    total,
    previewLoading,
    processing,
    handlePay,
  } = useCheckout(product, open, t);

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40">
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4">

        {/* REGION */}
        <div className="flex gap-2 overflow-x-auto mb-4">
          {availableRegions.map((r: any) => (
            <button
              key={r.zone}
              onClick={() => setZone(r.zone)}
              className={`px-3 py-2 border rounded ${
                zone === r.zone ? "bg-orange-500 text-white" : ""
              }`}
            >
              {r.zone}
            </button>
          ))}
        </div>

        {/* PRODUCT */}
        <p>{item.name}</p>

        {/* QTY */}
        <input value={qtyDraft} onChange={(e) => setQtyDraft(e.target.value)} />

        {/* TOTAL */}
        <p>{formatPi(total)} π</p>

        {previewLoading && <p>Đang tính phí...</p>}

        {/* BUTTON */}
        <button
          onClick={handlePay}
          disabled={processing}
          className="w-full bg-orange-500 text-white p-3 rounded"
        >
          PAY
        </button>
      </div>
    </div>
  );
}
