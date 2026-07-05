// =====================================================
// app/account/wallet/history/components/WithdrawHistoryCard.tsx
// =====================================================

"use client";

import {
  ArrowUpRight,
  Copy,
} from "lucide-react";

import type {
  WithdrawHistoryItem,
} from "../history.types";

import WithdrawStatusBadge
  from "./WithdrawStatusBadge";

/* =====================================================
   TYPES
===================================================== */

type Props = {
  item: WithdrawHistoryItem;
};

/* =====================================================
   HELPERS
===================================================== */

function formatDate(
  value: string
) {

  return new Date(
    value
  ).toLocaleString();

}

/* =====================================================
   COMPONENT
===================================================== */

export default function WithdrawHistoryCard({
  item,
}: Props) {

  const copyAddress =
    async () => {

      try {

        await navigator.clipboard.writeText(
          item.wallet_address
        );

      } catch {

        // ignore

      }

    };

  return (

    <div
      className="
        card
        p-4
      "
    >

      {/* ================= TOP ================= */}

      <div
        className="
          flex
          items-start
          justify-between
          gap-4
        "
      >

        <div>

          <div
            className="
              flex
              items-center
              gap-2
            "
          >

            <ArrowUpRight
              size={18}
              className="
                text-primary
              "
            />

            <span
              className="
                text-lg
                font-bold
              "
            >
              -π {item.amount}
            </span>

          </div>

          <p
            className="
              mt-1
              text-xs
              text-muted
            "
          >
            {formatDate(
              item.created_at
            )}
          </p>

        </div>

        <WithdrawStatusBadge
          status={
            item.status
          }
        />

      </div>

      {/* ================= ADDRESS ================= */}

      <div
        className="
          mt-4
          flex
          items-center
          justify-between
          gap-3
        "
      >

        <div
          className="
            min-w-0
            flex-1
          "
        >

          <p
            className="
              text-xs
              text-muted
            "
          >
            Wallet
          </p>

          <p
            className="
              truncate
              text-sm
              font-medium
            "
          >
            {item.wallet_address}
          </p>

        </div>

        <button
          type="button"
          onClick={
            copyAddress
          }
          className="
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-lg
            border
            border-border
            transition
            hover:bg-muted
          "
        >

          <Copy
            size={16}
          />

        </button>

      </div>

      {/* ================= INFO ================= */}

      <div
        className="
          mt-4
          grid
          grid-cols-2
          gap-4
          text-sm
        "
      >

        <div>

          <p
            className="
              text-muted
            "
          >
            Network
          </p>

          <p
            className="
              mt-1
              font-medium
            "
          >
            {item.network}
          </p>

        </div>

        <div>

          <p
            className="
              text-muted
            "
          >
            Receive
          </p>

          <p
            className="
              mt-1
              font-medium
            "
          >
            π {item.receive_amount}
          </p>

        </div>

      </div>

      {/* ================= TX ================= */}

      {item.tx_hash && (

        <div
          className="
            mt-4
            border-t
            border-border
            pt-4
          "
        >

          <p
            className="
              text-xs
              text-muted
            "
          >
            Transaction ID
          </p>

          <p
            className="
              mt-1
              break-all
              text-xs
              font-mono
            "
          >
            {item.tx_hash}
          </p>

        </div>

      )}

      {/* ================= NOTE ================= */}

      {item.admin_note && (

        <div
          className="
            mt-4
            rounded-xl
            bg-red-500/10
            p-3
          "
        >

          <p
            className="
              text-xs
              font-medium
              text-red-500
            "
          >
            Admin Note
          </p>

          <p
            className="
              mt-1
              text-sm
            "
          >
            {item.admin_note}
          </p>

        </div>

      )}

    </div>

  );

}
