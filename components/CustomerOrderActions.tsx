"use client";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

type Props = {
  status: string;
  onDetail: () => void;
  onReceived?: () => void;
  onBuyAgain?: () => void;
};

export default function CustomerOrderActions({
  status,
  onDetail,
  onReceived,
  onBuyAgain,
}: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="flex gap-2 flex-wrap"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onDetail}
        className="px-3 py-1.5 border rounded-lg text-sm active:scale-95 transition"
      >
        {t.detail ?? "Detail"}
      </button>

      {status === "shipping" && onReceived && (
        <button
          onClick={onReceived}
          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm active:scale-95 transition"
        >
          {t.received ?? "Received"}
        </button>
      )}

      {status === "completed" && onBuyAgain && (
        <button
          onClick={onBuyAgain}
          className="px-3 py-1.5 border border-orange-500 text-orange-500 rounded-lg text-sm active:scale-95 transition"
        >
          {t.buy_again ?? "Buy Again"}
        </button>
      )}
    </div>
  );
}
