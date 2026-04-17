"use client";

import { useMemo, useState } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* ================= TYPES ================= */

type Props = {
  orders: any[];
  onFiltered: (orders: any[]) => void;
};

export default function OrderFilterBar({ orders, onFiltered }: Props) {
  const { t } = useTranslation();

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  /* ================= FILTER ================= */

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const created = o.created_at
        ? new Date(o.created_at).getTime()
        : 0;

      const from = fromDate ? new Date(fromDate).getTime() : null;
      const to = toDate ? new Date(toDate).getTime() : null;

      const matchDate =
        (!from || created >= from) &&
        (!to || created <= to + 86400000);

      const keyword = search.toLowerCase();

      const matchSearch =
        !search ||
        o.id.toLowerCase().includes(keyword) ||
        (o.order_number ?? "").toLowerCase().includes(keyword);

      return matchDate && matchSearch;
    });
  }, [orders, search, fromDate, toDate]);

  /* ================= TRIGGER ================= */

  useMemo(() => {
    onFiltered(filtered);
  }, [filtered]);

  /* ================= UI ================= */

  return (
    <div className="px-4 mt-4 space-y-2">

      {/* SEARCH */}
      <input
        placeholder={t.search_order ?? "Search order ID"}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-2 rounded border"
      />

      {/* DATE */}
      <div className="flex gap-2">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="w-full p-2 border rounded"
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>

    </div>
  );
}
