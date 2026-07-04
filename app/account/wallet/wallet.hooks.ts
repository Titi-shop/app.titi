// =====================================================
// app/account/wallet/wallet.hooks.ts
// =====================================================

"use client";

import {
  useMemo,
  useState,
} from "react";

import useSWR from "swr";

import {
  WALLET_SWR_CONFIG,
} from "./wallet.constants";

import {
  fetchWallet,
} from "./wallet.api";

import {
  useAuth,
} from "@/context/AuthContext";

/* =====================================================
   HOOK
===================================================== */

export function useWallet() {

  const {
  user,
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
    error,
    isLoading,
    mutate,
  } = useSWR(
    !user || authLoading
    ? null
    : "wallet"

    fetchWallet,

    {
      ...WALLET_SWR_CONFIG,

      shouldRetryOnError:
        true,

      errorRetryCount:
        3,

      errorRetryInterval:
        2000,
    }
  );

  /* ===================================================
     BALANCE
  =================================================== */

  const balance =
    useMemo(() => {

      return (
        data?.balance ??
        {
          balance: 0,
          availableBalance: 0,
          pendingBalance: 0,
          frozenBalance: 0,
        }
      );

    }, [data]);

  /* ===================================================
     TRANSACTIONS
  =================================================== */

  const transactions =
    useMemo(() => {

      return (
        data?.transactions ??
        []
      );

    }, [data]);

  /* ===================================================
     WALLETS
  =================================================== */

  const wallets =
    useMemo(() => {

      return (
        data?.wallets ??
        []
      );

    }, [data]);

  const defaultWallet =
    useMemo(() => {

      return (
        data?.defaultWallet ??
        null
      );

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

    if (
      refreshing
    ) {
      return;
    }

    try {

      setRefreshing(
        true
      );

      await mutate();

    } finally {

      setRefreshing(
        false
      );

    }

  }

  /* ===================================================
     RETURN
  =================================================== */

  return {

    loading:
    authLoading ||
    (!user) ||
    (
        isLoading &&
        !data
    ),

    error,

    refreshing,

    balance,

    transactions,

    wallets,

    defaultWallet,

    totalIn,

    totalOut,

    refresh,

  };

}
