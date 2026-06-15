"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";

import {
  useMemo,
  useState,
} from "react";

import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  PiggyBank,
  RefreshCcw,
  Wallet,
} from "lucide-react";

import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

import { useAuth } from "@/context/AuthContext";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

/* =====================================================
   TYPES
===================================================== */

type TransactionDirection =
  | "CREDIT"
  | "DEBIT";

type EntryType =
  | "ESCROW_HOLD"
  | "BUYER_REFUND"
  | "BUYER_PARTIAL_REFUND"
  | "SELLER_CREDIT"
  | "SELLER_ESCROW_RELEASE"
  | "SELLER_WITHDRAW"
  | "SELLER_WITHDRAW_REVERT"
  | "ESCROW_RELEASE"
  | "ESCROW_REVERT"
  | "DISPUTE_LOCK"
  | "DISPUTE_RELEASE"
  | "DISPUTE_REFUND"
  | "ADMIN_ADJUST"
  | "ADMIN_REVERSE"
  | "SYSTEM_COMPENSATION";

type WalletTransaction = {
  id: string;
  direction: TransactionDirection;
  amount: number;
  entry_type: EntryType;
  created_at: string;
};

type WalletResponse = {
  balance: number;
  transactions: WalletTransaction[];
};

/* =====================================================
   FETCHER
===================================================== */

async function walletFetcher(
  url: string
): Promise<WalletResponse> {

  const response =
    await apiAuthFetch(url);

  if (!response.ok) {

    throw new Error(
      "WALLET_FETCH_FAILED"
    );
  }

  const data =
    await response.json();

  return {
    balance:
      Number(data.balance ?? 0),

    transactions:
      Array.isArray(
        data.transactions
      )
        ? data.transactions.map(
            (
              item: WalletTransaction
            ) => ({
              id:
                String(item.id),

              direction:
                item.direction ===
                "DEBIT"
                  ? "DEBIT"
                  : "CREDIT",

              amount:
                Number(
                  item.amount ?? 0
                ),

              entry_type:
                item.entry_type,

              created_at:
                String(
                  item.created_at
                ),
            })
          )
        : [],
  };
}

/* =====================================================
   UTILS
===================================================== */

function formatPi(
  value: number
): string {

  return value.toFixed(2);
}

function formatDate(
  value: string
): string {

  return new Intl.DateTimeFormat(
    "en-US",
    {
      hour12: false,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
}

function getEntryLabel(
  type: EntryType
): string {

  switch (type) {

    case "ESCROW_HOLD":
      return "Escrow Hold";

    case "BUYER_REFUND":
      return "Buyer Refund";

    case "BUYER_PARTIAL_REFUND":
      return "Partial Refund";

    case "SELLER_CREDIT":
      return "Seller Credit";

    case "SELLER_ESCROW_RELEASE":
      return "Escrow Released";

    case "SELLER_WITHDRAW":
      return "Withdraw";

    case "SELLER_WITHDRAW_REVERT":
      return "Withdraw Reverted";

    case "DISPUTE_LOCK":
      return "Dispute Locked";

    case "DISPUTE_RELEASE":
      return "Dispute Released";

    case "DISPUTE_REFUND":
      return "Dispute Refund";

    case "ADMIN_ADJUST":
      return "Admin Adjust";

    case "ADMIN_REVERSE":
      return "Admin Reverse";

    case "SYSTEM_COMPENSATION":
      return "System Compensation";

    default:
      return type;
  }
}

/* =====================================================
   PAGE
===================================================== */

export default function WalletPage() {

  const { t } =
    useTranslation();

  const {
    loading: authLoading,
  } = useAuth();

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  /* ===================================================
     SWR
  =================================================== */

  const {
    data,
    isLoading,
    mutate,
  } = useSWR<WalletResponse>(
    authLoading
      ? null
      : "/api/wallet",

    walletFetcher,

    {
      revalidateOnFocus:
        false,

      revalidateIfStale:
        false,

      dedupingInterval:
        15000,

      keepPreviousData:
        true,
    }
  );

  /* ===================================================
     BALANCE
  =================================================== */

  const balance =
    useMemo(() => {

      return Number(
        data?.balance ?? 0
      );

    }, [data]);

  /* ===================================================
     TRANSACTIONS
  =================================================== */

  const transactions =
    useMemo(() => {

      return data?.transactions ??
        [];

    }, [data]);

  /* ===================================================
     STATS
  =================================================== */

  const totalIn =
    useMemo(() => {

      return transactions
        .filter(
          (
            item
          ) =>
            item.direction ===
            "CREDIT"
        )
        .reduce(
          (
            total,
            item
          ) =>
            total +
            item.amount,

          0
        );

    }, [transactions]);

  const totalOut =
    useMemo(() => {

      return transactions
        .filter(
          (
            item
          ) =>
            item.direction ===
            "DEBIT"
        )
        .reduce(
          (
            total,
            item
          ) =>
            total +
            item.amount,

          0
        );

    }, [transactions]);

  /* ===================================================
     REFRESH
  =================================================== */

  async function refresh() {

    try {

      setRefreshing(true);

      await mutate();

    } finally {

      setRefreshing(false);
    }
  }

  /* ===================================================
     LOADING
  =================================================== */

  if (
    isLoading &&
    !data
  ) {

    return (
      <main className="min-h-screen bg-[var(--background)] p-4">

        <div
          className="
            h-52 animate-pulse rounded-3xl
            bg-[var(--card-secondary)]
          "
        />

        <div className="mt-4 space-y-3">

          {[1, 2, 3].map(
            (item) => (
              <div
                key={item}
                className="
                  h-20 animate-pulse rounded-2xl
                  bg-[var(--card-secondary)]
                "
              />
            )
          )}

        </div>

      </main>
    );
  }

  /* ===================================================
     UI
  =================================================== */

  return (
    <main className="min-h-screen bg-[var(--background)] pb-28">

      {/* HERO */}

      <section
        className="
          relative overflow-hidden
          rounded-b-[2.5rem]
          bg-gradient-to-br
          from-orange-500
          via-orange-500
          to-amber-500
          px-5 pb-8 pt-8
          text-white
        "
      >

        <div className="flex items-start justify-between">

          <div>

            <p className="text-sm text-white/80">
              {t.wallet_balance ??
                "Wallet Balance"}
            </p>

            <h1 className="mt-3 text-4xl font-black">
              π {formatPi(balance)}
            </h1>

          </div>

          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            className="
              flex h-11 w-11
              items-center justify-center
              rounded-2xl
              bg-white/10
            "
          >

            <RefreshCcw
              size={18}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

          </button>

        </div>

      </section>

      {/* STATS */}

      <section className="grid grid-cols-2 gap-4 px-4 pt-5">

        <div
          className="
            rounded-3xl
            bg-[var(--card-bg)]
            p-5
          "
        >

          <div
            className="
              flex h-12 w-12
              items-center justify-center
              rounded-2xl
              bg-green-500/10
              text-green-500
            "
          >
            <PiggyBank size={22} />
          </div>

          <p className="mt-4 text-xs text-[var(--text-muted)]">
            {t.wallet_total_in ??
              "Total In"}
          </p>

          <p className="mt-1 text-2xl font-bold text-green-500">
            +π {formatPi(totalIn)}
          </p>

        </div>

        <div
          className="
            rounded-3xl
            bg-[var(--card-bg)]
            p-5
          "
        >

          <div
            className="
              flex h-12 w-12
              items-center justify-center
              rounded-2xl
              bg-red-500/10
              text-red-500
            "
          >
            <Wallet size={22} />
          </div>

          <p className="mt-4 text-xs text-[var(--text-muted)]">
            {t.wallet_total_out ??
              "Total Out"}
          </p>

          <p className="mt-1 text-2xl font-bold text-red-500">
            -π {formatPi(totalOut)}
          </p>

        </div>

      </section>

      {/* TRANSACTIONS */}

      <section className="mt-6 px-4">

        <div className="mb-3 flex items-center justify-between">

          <h2 className="text-base font-bold">
            {t.wallet_transactions ??
              "Transactions"}
          </h2>

          <span className="text-xs text-[var(--text-muted)]">
            {transactions.length}
          </span>

        </div>

        <div
          className="
            overflow-hidden rounded-3xl
            bg-[var(--card-bg)]
          "
        >

          {transactions.length === 0 && (

            <div className="p-10 text-center">

              <div
                className="
                  mx-auto flex h-16 w-16
                  items-center justify-center
                  rounded-full
                  bg-orange-500/10
                  text-orange-500
                "
              >
                <Wallet size={28} />
              </div>

              <p className="mt-4 text-sm text-[var(--text-muted)]">
                {t.wallet_no_transactions ??
                  "No transactions yet"}
              </p>

            </div>
          )}

          {transactions.map(
            (item) => {

              const isCredit =
                item.direction ===
                "CREDIT";

              return (
                <div
                  key={item.id}
                  className="
                    flex items-center justify-between
                    border-b border-orange-500/5
                    p-4 last:border-b-0
                  "
                >

                  <div className="flex items-center gap-3">

                    <div
                      className={`
                        flex h-12 w-12
                        items-center justify-center
                        rounded-2xl
                        ${
                          isCredit
                            ? "bg-green-500/10 text-green-500"
                            : "bg-red-500/10 text-red-500"
                        }
                      `}
                    >

                      {isCredit ? (
                        <ArrowDownLeft size={20} />
                      ) : (
                        <ArrowUpRight size={20} />
                      )}

                    </div>

                    <div>

                      <p className="text-sm font-semibold">
                        {getEntryLabel(
                          item.entry_type
                        )}
                      </p>

                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {formatDate(
                          item.created_at
                        )}
                      </p>

                    </div>

                  </div>

                  <p
                    className={`
                      text-sm font-bold
                      ${
                        isCredit
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    `}
                  >

                    {isCredit
                      ? "+"
                      : "-"}

                    π
                    {formatPi(
                      item.amount
                    )}

                  </p>

                </div>
              );
            }
          )}

        </div>

      </section>

    </main>
  );
}
