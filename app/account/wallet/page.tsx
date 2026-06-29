// =====================================================
// app/account/wallet/page.tsx
// =====================================================

"use client";

export const dynamic =
  "force-dynamic";
import {
  useRouter,
} from "next/navigation";
import {
  useState,
} from "react";

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
const router =
  useRouter();
  /* ===================================================
     MODAL
  =================================================== */

  const [
    withdrawOpen,
    setWithdrawOpen,
  ] = useState(false);

  /* ===================================================
     LOADING
  =================================================== */

  if (loading) {

    return (
      <WalletSkeleton />
    );
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
  balance={balance.balance}
  refreshing={refreshing}
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
/>

        {/* STATS */}

        <WalletStats
          totalIn={totalIn}
          totalOut={totalOut}
        />

        {/* TRANSACTIONS */}

        <WalletTransactionList
          transactions={
            transactions
          }
        />

      </main>

      {/* WITHDRAW MODAL */}

    <WalletWithdrawModal
  open={withdrawOpen}
  wallets={wallets}
  defaultWallet={defaultWallet}
  onClose={() => {
    setWithdrawOpen(false);
  }}
  onSuccess={refresh}
/>
    </>
  );
}
