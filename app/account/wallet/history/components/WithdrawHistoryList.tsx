// =====================================================
// app/account/wallet/history/components/WithdrawHistoryList.tsx
// =====================================================

"use client";

import type {
  WithdrawHistoryItem,
} from "../history.types";

import WithdrawHistoryCard
  from "./WithdrawHistoryCard";

/* =====================================================
   TYPES
===================================================== */

type Props = {
  items: WithdrawHistoryItem[];
};

/* =====================================================
   COMPONENT
===================================================== */

export default function WithdrawHistoryList({
  items,
}: Props) {

  /* ===================================================
     EMPTY
  =================================================== */

  if (items.length === 0) {

    return (

      <div
        className="
          flex
          min-h-[40vh]
          items-center
          justify-center
          px-6
          text-center
        "
      >

        <div>

          <h3
            className="
              text-lg
              font-semibold
            "
          >
            No withdrawal requests
          </h3>

          <p
            className="
              mt-2
              text-sm
              text-muted
            "
          >
            Your withdrawal history will appear here.
          </p>

        </div>

      </div>

    );

  }

  /* ===================================================
     LIST
  =================================================== */

  return (

    <div
      className="
        space-y-4
        px-4
        pb-6
      "
    >

      {items.map(
        (
          item
        ) => (

          <WithdrawHistoryCard
            key={
              item.id
            }
            item={
              item
            }
          />

        )
      )}

    </div>

  );

}
