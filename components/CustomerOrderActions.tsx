"use client";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

type Props = {
  status: string;
  onDetail: () => void;
  onCancel?: () => void;
  onReceived?: () => void;
  onBuyAgain?: () => void;
};

export default function CustomerOrderActions({
  status,
  onDetail,
  onCancel,
  onReceived,
  onBuyAgain,
}: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="flex gap-2 flex-wrap"
      onClick={(e) => e.stopPropagation()}
    >
      {/* DETAIL */}
      <button
        onClick={onDetail}
        className="px-3 py-1.5 border rounded-lg text-sm active:scale-95"
      >
        {t.detail ?? "Detail"}
      </button>

      {/* PENDING => CANCEL */}
      {status === "pending" && onCancel && (
        <button
          onClick={onCancel}
          className="px-3 py-1.5 border border-red-500 text-red-500 rounded-lg text-sm active:scale-95"
        >
          {t.cancel_order ?? "Cancel"}
        </button>
      )}

      {/* SHIPPING => RECEIVED */}
      {status === "shipping" && onReceived && (
        <button
          onClick={onReceived}
          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm active:scale-95"
        >
          {t.received ?? "Received"}
        </button>
      )}

      {/* COMPLETED => BUY AGAIN */}
      {status === "completed" && onBuyAgain && (
        <button
          onClick={onBuyAgain}
          className="px-3 py-1.5 border border-orange-500 text-orange-500 rounded-lg text-sm active:scale-95"
        >
          {t.buy_again ?? "Buy Again"}
        </button>
      )}
    </div>
  );
}
