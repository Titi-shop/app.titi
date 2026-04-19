"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* ================= TYPES ================= */

type Tx = {
  id: string;
  type: "credit" | "debit";
  amount: number;
  reference_type: string;
  created_at: string;
};

/* ================= UTILS ================= */

function formatPi(n: number): string {
  return Number(n).toFixed(2);
}

function formatTime(date: string): string {
  return new Date(date).toLocaleString();
}

/* ================= PAGE ================= */

export default function WalletPage() {
  const { t } = useTranslation();
  const { loading: authLoading } = useAuth();

  const [balance, setBalance] = useState<number>(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const hasLoaded = useRef<boolean>(false);

  /* ================= LOAD ================= */

  useEffect(() => {
    if (authLoading) return;
    if (hasLoaded.current) return;

    hasLoaded.current = true;
    load();
  }, [authLoading]);

  async function load(): Promise<void> {
    try {
      console.log("🟡 [WALLET][LOAD]");

      const [w, tRes] = await Promise.all([
        apiAuthFetch("/api/wallet", { cache: "no-store" }),
        apiAuthFetch("/api/wallet/transactions", { cache: "no-store" }),
      ]);

      /* ================= WALLET ================= */

      if (w.ok) {
        const wJson: unknown = await w.json();

        if (
          typeof wJson === "object" &&
          wJson !== null &&
          "balance" in wJson
        ) {
          const value = Number(
            (wJson as { balance: unknown }).balance
          );

          setBalance(Number.isNaN(value) ? 0 : value);
        }
      }

      /* ================= TX ================= */

      if (tRes.ok) {
        const tJson: unknown = await tRes.json();

        if (Array.isArray(tJson)) {
          const safe: Tx[] = tJson.filter(
            (i): i is Tx =>
              typeof i === "object" &&
              i !== null &&
              typeof i.id === "string" &&
              (i.type === "credit" || i.type === "debit") &&
              typeof i.amount !== "undefined" &&
              typeof i.reference_type === "string" &&
              typeof i.created_at === "string"
          );

          setTxs(safe);
        }
      }

      console.log("🟢 [WALLET][LOAD_SUCCESS]");
    } catch (err) {
      console.error("❌ [WALLET][LOAD_ERROR]");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function refresh(): Promise<void> {
    if (refreshing) return;
    setRefreshing(true);
    await load();
  }

  /* ================= LABEL ================= */

  function getRefLabel(type: string): string {
    switch (type) {
      case "order":
        return t.wallet_ref_order;
      case "refund":
        return t.wallet_ref_refund;
      case "withdraw":
        return t.wallet_ref_withdraw;
      case "deposit":
        return t.wallet_ref_deposit;
      default:
        return type;
    }
  }

  /* ================= UI ================= */

  if (loading) {
    return (
      <main className="p-4 space-y-4 animate-pulse">
        <div className="h-24 bg-gray-200 rounded-xl" />
        <div className="h-40 bg-gray-200 rounded-xl" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-5 rounded-b-2xl shadow">

        <div className="flex justify-between items-center">
          <p className="text-sm opacity-80">
            {t.wallet_balance}
          </p>

          <button
            onClick={refresh}
            className="text-xs bg-white/20 px-3 py-1 rounded-full"
          >
            {refreshing ? "..." : t.wallet_refresh}
          </button>
        </div>

        <h1 className="text-3xl font-bold mt-2">
          π {formatPi(balance)}
        </h1>

        {/* ACTIONS */}
        <div className="flex gap-3 mt-5">

          <button className="flex-1 bg-white text-orange-600 py-2 rounded-xl text-sm font-semibold">
            {t.wallet_deposit}
          </button>

          <button className="flex-1 bg-white text-orange-600 py-2 rounded-xl text-sm font-semibold">
            {t.wallet_withdraw}
          </button>

          <button className="flex-1 bg-white text-orange-600 py-2 rounded-xl text-sm font-semibold">
            {t.wallet_pay}
          </button>

        </div>
      </div>

      {/* QUICK INFO */}
      <div className="p-4 grid grid-cols-2 gap-3">

        <div className="bg-white p-4 rounded-xl shadow">
          <p className="text-xs text-gray-400">
            {t.wallet_total_in}
          </p>
          <p className="text-green-600 font-semibold">
            +π{" "}
            {formatPi(
              txs
                .filter((i) => i.type === "credit")
                .reduce((a, b) => a + Number(b.amount), 0)
            )}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow">
          <p className="text-xs text-gray-400">
            {t.wallet_total_out}
          </p>
          <p className="text-red-500 font-semibold">
            -π{" "}
            {formatPi(
              txs
                .filter((i) => i.type === "debit")
                .reduce((a, b) => a + Number(b.amount), 0)
            )}
          </p>
        </div>

      </div>

      {/* TRANSACTIONS */}
      <div className="px-4 mt-2">

        <p className="text-sm font-semibold mb-2">
          {t.wallet_transactions}
        </p>

        <div className="bg-white rounded-xl shadow divide-y">

          {txs.length === 0 && (
            <div className="p-6 text-center text-gray-400 text-sm">
              {t.wallet_no_transactions}
            </div>
          )}

          {txs.map((item) => (
            <div
              key={item.id}
              className="p-4 flex justify-between items-center"
            >

              <div>
                <p className="text-sm font-medium">
                  {getRefLabel(item.reference_type)}
                </p>

                <p className="text-xs text-gray-400">
                  {formatTime(item.created_at)}
                </p>
              </div>

              <p
                className={`text-sm font-semibold ${
                  item.type === "credit"
                    ? "text-green-600"
                    : "text-red-500"
                }`}
              >
                {item.type === "credit" ? "+" : "-"}π
                {formatPi(item.amount)}
              </p>

            </div>
          ))}

        </div>
      </div>

    </main>
  );
}
