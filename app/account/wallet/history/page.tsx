// =====================================================
// app/account/wallet/history/page.tsx
// =====================================================

"use client";

export const dynamic =
  "force-dynamic";

import {
  useEffect,
} from "react";

import {
  ArrowLeft,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

import {
  useAuth,
} from "@/context/AuthContext";

import {
  useWithdrawHistory,
} from "./history.hooks";

import WithdrawTabs
  from "./components/WithdrawTabs";

import WithdrawHistoryList
  from "./components/WithdrawHistoryList";

import WithdrawHistorySkeleton
  from "./components/WithdrawHistorySkeleton";

import EmptyWithdrawHistory
  from "./components/EmptyWithdrawHistory";

/* =====================================================
   PAGE
===================================================== */

export default function WalletHistoryPage() {

  const router =
    useRouter();

  const { t } =
    useTranslation();

  /* ===================================================
     AUTH
  =================================================== */

  const {

    user,

    loading:
      authLoading,

  } = useAuth();

  /* ===================================================
     HISTORY
  =================================================== */

  const {

    loading,

    filteredItems,

    filter,

    counts,

    setFilter,

  } =
    useWithdrawHistory();

  /* ===================================================
     LOGIN
  =================================================== */

  useEffect(() => {

    if (
      authLoading
    ) {

      return;

    }

    if (!user) {

      router.replace(
        "/login"
      );

    }

  }, [

    authLoading,

    user,

    router,

  ]);

  /* ===================================================
     AUTH LOADING
  =================================================== */

  if (

    authLoading ||

    !user

  ) {

    return (
      <WithdrawHistorySkeleton />
    );

  }

  /* ===================================================
     DATA LOADING
  =================================================== */

  if (
    loading
  ) {

    return (
      <WithdrawHistorySkeleton />
    );

  }

  /* ===================================================
     PAGE
  =================================================== */

  return (

    <main
      className="
        min-h-screen
        bg-[var(--background)]
        pb-24
      "
    >

      {/* ==========================================
          HEADER
      ========================================== */}

      <header
        className="
          sticky
          top-0
          z-20
          flex
          items-center
          gap-3
          border-b
          border-border
          bg-background/95
          px-4
          py-4
          backdrop-blur
        "
      >

        <button
          type="button"
          onClick={() => {

            router.back();

          }}
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            transition
            hover:bg-muted
          "
        >

          <ArrowLeft
            size={20}
          />

        </button>

        <div>

          <h1
            className="
              text-lg
              font-bold
            "
          >

            {t.wallet_history ??
              "Withdrawal History"}

          </h1>

          <p
            className="
              text-sm
              text-muted
            "
          >

            {t.wallet_history_desc ??
              "View all withdrawal requests"}

          </p>

        </div>

      </header>

      {/* ==========================================
          FILTER
      ========================================== */}

      <WithdrawTabs

        value={
          filter
        }

        counts={
          counts
        }

        onChange={
          setFilter
        }

      />

      {/* ==========================================
          CONTENT
      ========================================== */}

      {filteredItems.length === 0 ? (

        <EmptyWithdrawHistory />

      ) : (

        <WithdrawHistoryList
          items={
            filteredItems
          }
        />

      )}

    </main>

  );

}
