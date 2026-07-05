// =====================================================
// app/account/wallet/history/history.hooks.ts
// =====================================================

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getWithdrawHistory,
} from "./history.api";

import type {
  WithdrawFilter,
  WithdrawHistoryItem,
} from "./history.types";

/* =====================================================
   HOOK
===================================================== */

export function useWithdrawHistory() {

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    items,
    setItems,
  ] = useState<
    WithdrawHistoryItem[]
  >([]);

  const [
    filter,
    setFilter,
  ] = useState<
    WithdrawFilter
  >("all");

  /* ===================================================
     LOAD
  =================================================== */

  const load =
    useCallback(
      async (
        refresh = false
      ) => {

        try {

          if (refresh) {

            setRefreshing(
              true
            );

          } else {

            setLoading(
              true
            );

          }

          const data =
            await getWithdrawHistory();

          setItems(
            data.items ?? []
          );

        } finally {

          setLoading(
            false
          );

          setRefreshing(
            false
          );

        }

      },
      []
    );

  /* ===================================================
     INIT
  =================================================== */

  useEffect(() => {

    void load();

  }, [load]);

  /* ===================================================
     FILTERED ITEMS
  =================================================== */

  const filteredItems =
    useMemo(() => {

      if (
        filter === "all"
      ) {

        return items;

      }

      return items.filter(
        (
          item
        ) =>
          item.status ===
          filter
      );

    }, [
      items,
      filter,
    ]);

  /* ===================================================
     COUNTS
  =================================================== */

  const counts =
    useMemo(
      () => ({

        all:
          items.length,

        pending:
          items.filter(
            (
              item
            ) =>
              item.status ===
              "pending"
          ).length,

        processing:
          items.filter(
            (
              item
            ) =>
              item.status ===
              "processing"
          ).length,

        completed:
          items.filter(
            (
              item
            ) =>
              item.status ===
              "completed"
          ).length,

        rejected:
          items.filter(
            (
              item
            ) =>
              item.status ===
              "rejected"
          ).length,

        cancelled:
          items.filter(
            (
              item
            ) =>
              item.status ===
              "cancelled"
          ).length,

      }),
      [items]
    );

  /* ===================================================
     RETURN
  =================================================== */

  return {

    loading,

    refreshing,

    items,

    filteredItems,

    filter,

    counts,

    setFilter,

    refresh: () =>
      load(true),

  };

}
