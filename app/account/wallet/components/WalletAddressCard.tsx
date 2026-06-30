// =====================================================
// app/account/wallet/components/WalletAddressCard.tsx
// =====================================================

"use client";

import {
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Wallet,
} from "lucide-react";

import type {
  WalletAddress,
} from "../wallet.types";

import {
  formatWalletAddress,
} from "../wallet.utils";
import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";
/* =====================================================
   TYPES
===================================================== */

type Props = {

  wallet:
    WalletAddress | null;

  onClick?: () => void;

};

/* =====================================================
   COMPONENT
===================================================== */
export default function WalletAddressCard({

  wallet,

  onClick,

}: Props) {
const { t } =
  useTranslation();
  return (

    <button
      type="button"
      onClick={onClick}
      className="
        w-full
        card-flat
        p-4
        transition-all
        active:scale-[0.98]
      "
    >

      <div
        className="
          flex
          items-center
          justify-between
          gap-4
        "
      >

        {/* LEFT */}

        <div
          className="
            flex
            items-center
            gap-3
          "
        >

          <div
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-primary/10
              text-primary
            "
          >

            <Wallet
              size={20}
            />

          </div>

          <div
            className="
              text-left
            "
          >

            <p
              className="
                text-xs
                text-muted
              "
            >
              {t.wallet_address}
            </p>

          <p
  className="mt-1 font-semibold"
  style={{
    color: "var(--text-primary)",
  }}
>
  {wallet
    ? formatWalletAddress(wallet.address)
    : (
        t.wallet_select ??
        "Select Wallet"
      )}
</p>

            {wallet && (

              <div
                className="
                  mt-1
                  flex
                  items-center
                  gap-1
                  text-xs
                "
              >

              {wallet.isVerified ? (

                  <>

                    <CheckCircle2
                      size={13}
                      className="text-success"
                    />

                    <span
                      className="text-success"
                    >
                      {t.wallet_verified}
                    </span>

                  </>

                ) : (

                  <>

                    <AlertCircle
                      size={13}
                      className="text-warning"
                    />

                    <span
                      className="text-warning"
                    >
                      {t.wallet_unverified}
                    </span>

                  </>

                )}

              </div>

            )}

          </div>

        </div>

        {/* RIGHT */}

        <ChevronRight
          size={18}
          className="
            text-[var(--text-muted)]
          "
        />

      </div>

    </button>

  );

}
