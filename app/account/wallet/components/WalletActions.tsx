// =====================================================
// app/account/wallet/components/WalletActions.tsx
// =====================================================
"use client";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
} from "lucide-react";
import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";
/* =====================================================
   TYPES
===================================================== */
type Props = {
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onPay?: () => void;
};
/* =====================================================
   COMPONENT
===================================================== */
export default function WalletActions({
  onDeposit,
  onWithdraw,
  onPay,
}: Props) {
  const { t } =
    useTranslation();
  return (
    <div className="relative z-10 mt-8 grid grid-cols-3 gap-3">
      {/* DEPOSIT */}
      <button
        type="button"
        onClick={onDeposit}
        className="
          rounded-2xl
          border border-white/15
          bg-white/10
          p-3
          backdrop-blur-md
          transition-all duration-200
          active:scale-95
        "
      >
        <div
          className="
            mx-auto flex h-11 w-11
            items-center justify-center
            rounded-xl bg-white/15
          "
        >
          <ArrowDownLeft
            size={20}
          />
        </div>
        <p className="mt-2 text-xs font-semibold">
          {t.wallet_deposit ??
            "Deposit"}
        </p>
      </button>
      {/* WITHDRAW */}
      <button
        type="button"
        onClick={onWithdraw}
        className="
          rounded-2xl
          border border-white/15
          bg-white/10
          p-3
          backdrop-blur-md
          transition-all duration-200
          active:scale-95
        "
      >
        <div
          className="
            mx-auto flex h-11 w-11
            items-center justify-center
            rounded-xl bg-white/15
          "
        >
          <ArrowUpRight
            size={20}
          />
        </div>
        <p className="mt-2 text-xs font-semibold">
          {t.wallet_withdraw ??
            "Withdraw"}
        </p>
      </button>
      {/* PAY */}
      <button
        type="button"
        onClick={onPay}
        className="
          rounded-2xl
          border border-white/15
          bg-white/10
          p-3
          backdrop-blur-md
          transition-all duration-200
          active:scale-95
        "
      >
        <div
          className="
            mx-auto flex h-11 w-11
            items-center justify-center
            rounded-xl bg-white/15
          "
        >
          <CreditCard
            size={20}
          />
        </div>
        <p className="mt-2 text-xs font-semibold">
          {t.wallet_pay ??
            "Pay"}
        </p>
      </button>
    </div>
  );
}
// =====================================================
// app/account/wallet/components/WalletHero.tsx
// =====================================================
"use client";
import {
  RefreshCcw,
} from "lucide-react";
import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";
import WalletActions
  from "./WalletActions";
import {
  formatPi,
} from "../wallet.utils";
/* =====================================================
   TYPES
===================================================== */
type Props = {
  balance: number;
  refreshing: boolean;
  onRefresh: () => void;
};
/* =====================================================
   COMPONENT
===================================================== */
export default function WalletHero({
  balance,
  refreshing,
  onRefresh,
}: Props) {
  const { t } =
    useTranslation();
  return (
    <section
      className="
        relative overflow-hidden
        rounded-b-[2.5rem]
        border-b border-orange-500/10
        bg-gradient-to-br
        from-orange-500
        via-orange-500
        to-amber-500
        px-5 pb-8 pt-8
        text-white
        shadow-xl
      "
    >
      {/* glow */}
      <div
        className="
          absolute -right-10 -top-10
          h-40 w-40 rounded-full
          bg-white/10 blur-3xl
        "
      />
      <div
        className="
          absolute bottom-0 left-0
          h-32 w-32 rounded-full
          bg-yellow-300/10 blur-3xl
        "
      />
      {/* top */}
      <div
        className="
          relative z-10 flex items-start
          justify-between gap-4
        "
      >
        <div>
          <p className="text-sm text-white/80">
            {t.wallet_balance ??
              "Wallet Balance"}
          </p>
          <h1
            className="
              mt-3 text-4xl
              font-black tracking-tight
            "
          >
            π {formatPi(balance)}
          </h1>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="
            flex h-11 w-11
            items-center justify-center
            rounded-2xl
            border border-white/20
            bg-white/10
            backdrop-blur-md
            transition-all duration-200
            active:scale-95
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
      <WalletActions />
    </section>
  );
}
// =====================================================
// app/account/wallet/components/WalletSkeleton.tsx
// =====================================================
"use client";
/* =====================================================
   COMPONENT
===================================================== */
export default function WalletSkeleton() {
  return (
    <main
      className="
        min-h-screen
        bg-[var(--background)]
        p-4
      "
    >
      <div
        className="
          h-52 animate-pulse
          rounded-3xl
          bg-[var(--card-secondary)]
        "
      />
      <div className="mt-4 space-y-3">
        {[1, 2, 3, 4].map(
          (item) => (
            <div
              key={item}
              className="
                h-20 animate-pulse
                rounded-2xl
                bg-[var(--card-secondary)]
              "
            />
          )
        )}
      </div>
    </main>
  );
}
