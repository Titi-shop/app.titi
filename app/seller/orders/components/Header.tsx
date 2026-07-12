"use client";

import { Package } from "lucide-react";

import { formatPi } from "@/lib/pi";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

type Props = {
  title: string;
  totalOrders: number;
  totalAmount: number;
};

export default function Header({
  title,
  totalOrders,
  totalAmount,
}: Props) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex items-center justify-between px-4 py-4">

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-white">
            <Package size={22} />
          </div>

          <div>
            <h1 className="text-lg font-bold">
              {title}
            </h1>

            <p className="text-xs text-gray-500 dark:text-zinc-400">
              {totalOrders} {t.orders ?? "orders"}
            </p>
          </div>

        </div>

        <div className="rounded-2xl bg-orange-50 px-4 py-2 text-right dark:bg-orange-900/20">

          <div className="text-xs text-gray-500 dark:text-zinc-400">
            {t.total ?? "Total"}
          </div>

          <div className="font-semibold text-orange-600 dark:text-orange-300">
            π{formatPi(totalAmount)}
          </div>

        </div>

      </div>
    </header>
  );
}
