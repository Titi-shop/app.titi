// =====================================================
// app/account/wallet/components/WalletDefaultAddress.tsx
// =====================================================

"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Wallet,
} from "lucide-react";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

import {
  formatWalletAddress,
} from "../wallet.utils";

/* =====================================================
   TYPES
===================================================== */

type Props = {
  wallet: {
    address: string;
    network: string;
    is_verified: boolean;
  } | null;

  onClick?: () => void;
};

/* =====================================================
   COMPONENT
===================================================== */

export default function WalletDefaultAddress({
  wallet,
  onClick,
}: Props) {

  const { t } = useTranslation();

  const copyAddress = async (
    e: React.MouseEvent<HTMLButtonElement>
  ) => {

    e.stopPropagation();

    if (!wallet?.address) return;

    try {

      await navigator.clipboard.writeText(
        wallet.address
      );

    } catch {

      const textarea =
        document.createElement("textarea");

      textarea.value = wallet.address;

      document.body.appendChild(textarea);

      textarea.select();

      document.execCommand("copy");

      document.body.removeChild(textarea);

    }

  };

  if (!wallet) {

    return null;

  }

  return (

    <button
      type="button"
      onClick={onClick}
      className="
        card
        mt-5
        flex
        w-full
        items-center
        justify-between
        gap-3
        px-4
        py-3
        text-left
        active:scale-[0.98]
        transition-all
      "
    >

      {/* ================= LEFT ================= */}

      <div
        className="
          flex
          min-w-0
          flex-1
          items-center
          gap-3
        "
      >

        {/* ICON */}

        <div
          className="
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-primary/10
            text-primary
          "
        >

          <Wallet size={18} />

        </div>

        {/* CONTENT */}

        <div className="min-w-0 flex-1">

          {/* ADDRESS */}

          <p
            className="
              truncate
              text-sm
              font-semibold
            "
            style={{
              color:
                "var(--text-primary)",
            }}
          >
            {formatWalletAddress(
              wallet.address
            )}
          </p>

          {/* STATUS */}

          <div
            className="
              mt-1
              flex
              items-center
              gap-2
            "
          >

            {wallet.is_verified ? (

              <span
                className="
                  inline-flex
                  items-center
                  gap-1
                  rounded-full
                  bg-emerald-500/10
                  px-2.5
                  py-1
                  text-xs
                  font-medium
                  text-emerald-600
                  dark:text-emerald-400
                "
              >

                <CheckCircle2
                  size={13}
                />

                {t.wallet_verified ??
                  "Đã xác minh"}

              </span>

            ) : (

              <span
                className="
                  inline-flex
                  items-center
                  gap-1
                  rounded-full
                  bg-amber-500/10
                  px-2.5
                  py-1
                  text-xs
                  font-medium
                  text-amber-600
                  dark:text-amber-400
                "
              >

                <AlertCircle
                  size={13}
                />

                {t.wallet_unverified ??
                  "Chưa xác minh"}

              </span>

            )}

          </div>

        </div>

      </div>

      {/* ================= RIGHT ================= */}

      <div
        className="
          flex
          items-center
          gap-2
          shrink-0
        "
      >

        {/* COPY */}

        <button
          type="button"
          onClick={copyAddress}
          title={t.copy ?? "Copy"}
          className="
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-lg
            bg-primary/10
            text-primary
            transition
            hover:bg-primary/20
            active:scale-95
          "
        >

          <Copy
            size={17}
          />

        </button>

        {/* GO */}

        <ChevronRight
          size={18}
          className="
            text-muted
          "
        />

      </div>

    </button>

  );

}
