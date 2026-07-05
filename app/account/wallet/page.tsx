// =====================================================
// app/account/wallet/page.tsx
// =====================================================

"use client";

export const dynamic =
  "force-dynamic";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  useAuth,
} from "@/context/AuthContext";

import WalletHero
  from "./components/WalletHero";

import WalletStats
  from "./components/WalletStats";

import WalletSkeleton
  from "./components/WalletSkeleton";

import WalletTransactionList
  from "./components/WalletTransactionList";

import WalletWithdrawModal
  from "./components/WalletWithdrawModal";

import {
  useWallet,
} from "./wallet.hooks";

/* =====================================================
   PAGE
===================================================== */

export default function WalletPage() {

  const router =
    useRouter();

  /* ===================================================
     AUTH
  =================================================== */

  const {

    user,

    loading: authLoading,

  } = useAuth();

  /* ===================================================
     WALLET
  =================================================== */

  const {

    loading,

    refreshing,

    balance,

    wallets,

    defaultWallet,

    transactions,

    totalIn,

    totalOut,

    refresh,

  } = useWallet();

  /* ===================================================
     MODAL
  =================================================== */

  const [

    withdrawOpen,

    setWithdrawOpen,

  ] = useState(false);

  /* ===================================================
     LOGIN CHECK
  =================================================== */

  useEffect(() => {

    if (

      !authLoading &&

      !user

    ) {

      router.replace("/");

    }

  }, [

    authLoading,

    user,

    router,

  ]);

  /* ===================================================
     LOADING
  =================================================== */

  if (

    authLoading ||

    loading

  ) {

    return (

      <WalletSkeleton />

    );

  }

  /* ===================================================
     NOT LOGIN
  =================================================== */

  if (!user) {

    return null;

  }

  /* ===================================================
     UI
  =================================================== */

  return (

    <>

      <main
        className="
          min-h-screen
          bg-[var(--background)]
          pb-40
          transition-colors
          duration-300
        "
      >

        {/* HERO */}

        <WalletHero
          balance={
            balance.balance
          }
          refreshing={
            refreshing
          }
          defaultWallet={
            defaultWallet
              ? {
                  address:
                    defaultWallet.address,
                  network:
                    defaultWallet.network,
                  is_verified:
                    defaultWallet.isVerified,
                }
              : null
          }
          onRefresh={() => {
            void refresh();
          }}
          onWalletClick={() => {
            router.push(
              "/account/wallet/addresses"
            );
          }}
          onWithdraw={() => {
            setWithdrawOpen(
              true
            );
          }}
          onSecurity={() => {
            router.push(
              "/account/wallet/security"
            );
          }}
          onHistory={() => {
            router.push(
              "/account/wallet/history"
            );
          }}
        />

        {/* STATS */}

        <WalletStats
          totalIn={
            totalIn
          }
          totalOut={
            totalOut
          }
        />

        {/* TRANSACTIONS */}

        <WalletTransactionList
          transactions={
            transactions
          }
        />

      </main>

      {/* WITHDRAW */}

      <WalletWithdrawModal
        open={
          withdrawOpen
        }
        wallets={
          wallets
        }
        defaultWallet={
          defaultWallet
        }
        onClose={() => {
          setWithdrawOpen(
            false
          );
        }}
        onSuccess={
          refresh
        }
      />

    </>

  );

}
