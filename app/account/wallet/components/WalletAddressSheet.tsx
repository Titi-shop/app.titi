// =====================================================
// app/account/wallet/components/WalletAddressSheet.tsx
// =====================================================

"use client";

import {
  CheckCircle2,
  AlertCircle,
  Check,
  X,
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

  open: boolean;

  wallets:
    WalletAddress[];

  selected:
    WalletAddress | null;

  onSelect: (
    wallet: WalletAddress
  ) => void;

  onClose: () => void;

};

/* =====================================================
   COMPONENT
===================================================== */

export default function WalletAddressSheet({

  open,
  wallets,
  selected,
  onSelect,
  onClose,

}: Props) {
const { t } =
  useTranslation();
  if (!open) {
    return null;
  }

  return (

    <div
      className="
        fixed
        inset-0
        z-[60]
        bg-black/50
      "
    >

      {/* BACKDROP */}

      <button
        type="button"
        onClick={onClose}
        className="
          absolute
          inset-0
        "
      />

      {/* SHEET */}

   <div
  className="
    absolute
    bottom-0
    left-0
    right-0
    rounded-t-[2rem]
    bg-[var(--card-bg)]
    p-5
    pb-[calc(env(safe-area-inset-bottom)+72px)]
    shadow-2xl
  "
>

        {/* HEADER */}

        <div
          className="
            mb-5
            flex
            items-center
            justify-between
          "
        >

          <h2
            className="
              text-lg
              font-bold
              text-[var(--foreground)]
            "
          >
            {t.wallet_select}
          </h2>

          <button
            type="button"
            onClick={onClose}
          >
            <X size={20} />
          </button>

        </div>

        {/* LIST */}

        <div
          className="
            space-y-3
            max-h-[55vh]
            overflow-y-auto
          "
        >

          {wallets.map(
            (wallet) => (

              <button
                key={wallet.id}
                type="button"
                onClick={() => {

                  onSelect(wallet);

                  onClose();

                }}
                className="
  card-flat
  flex
  w-full
  items-center
  justify-between
  p-4
  text-left
"
              >

                <div>

                  <p
  className="font-semibold"
  style={{
    color: "var(--text-primary)",
  }}
>
                    {formatWalletAddress(
                      wallet.address
                    )}
                  </p>

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
                          className="
                            text-success
                          "
                        />

                        <span>
                          {t.wallet_verified}
                        </span>

                      </>

                    ) : (

                      <>

                        <AlertCircle
                          size={13}
                          className="
                            text-warning
                          "
                        />

                        <span>
                          {t.wallet_unverified}
                        </span>

                      </>

                    )}

                  </div>

                </div>

                {selected?.id ===
                  wallet.id && (

                  <Check
                    size={20}
                    className="
                      text-primary
                    "
                  />

                )}

              </button>

            )
          )}

        </div>

      </div>

    </div>

  );

}
