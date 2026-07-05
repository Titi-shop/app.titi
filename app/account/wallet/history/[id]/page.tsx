// =====================================================
// app/account/wallet/history/[id]/page.tsx
// =====================================================

"use client";

export const dynamic =
  "force-dynamic";

import {
  ArrowLeft,
  Copy,
} from "lucide-react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

/* =====================================================
   PAGE
===================================================== */

export default function WithdrawDetailPage() {

  const router =
    useRouter();

  const params =
    useParams();

  const { t } =
    useTranslation();

  return (

    <main
      className="
        min-h-screen
        bg-[var(--background)]
      "
    >

      {/* HEADER */}

      <header
        className="
          sticky
          top-0
          z-20
          flex
          items-center
          gap-3
          border-b
          border-border
          bg-background
          px-4
          py-4
        "
      >

        <button
          type="button"
          onClick={() => {
            router.back();
          }}
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            hover:bg-muted
          "
        >

          <ArrowLeft
            size={20}
          />

        </button>

        <h1
          className="
            text-lg
            font-bold
          "
        >
          {t.withdraw_detail ??
            "Withdrawal Detail"}
        </h1>

      </header>

      {/* CONTENT */}

      <div
        className="
          space-y-4
          p-4
        "
      >

        <div className="card p-4">

          <div className="space-y-4">

            <Row
              label="Request ID"
              value={
                String(
                  params.id
                )
              }
            />

            <Row
              label="Amount"
              value="π --"
            />

            <Row
              label="Fee"
              value="π --"
            />

            <Row
              label="Receive"
              value="π --"
            />

            <Row
              label="Status"
              value="Pending"
            />

            <Row
              label="Network"
              value="Pi Network"
            />

            <CopyRow
              label="Wallet"
              value="G..."
            />

            <CopyRow
              label="Transaction ID"
              value="--"
            />

            <Row
              label="Created"
              value="--"
            />

            <Row
              label="Processed"
              value="--"
            />

            <Row
              label="Admin Note"
              value="-"
            />

          </div>

        </div>

      </div>

    </main>

  );

}

/* =====================================================
   ROW
===================================================== */

function Row({

  label,

  value,

}: {

  label: string;

  value: string;

}) {

  return (

    <div
      className="
        flex
        items-center
        justify-between
        gap-4
      "
    >

      <span
        className="
          text-sm
          text-muted
        "
      >
        {label}
      </span>

      <span
        className="
          text-right
          text-sm
          font-medium
        "
      >
        {value}
      </span>

    </div>

  );

}

/* =====================================================
   COPY ROW
===================================================== */

function CopyRow({

  label,

  value,

}: {

  label: string;

  value: string;

}) {

  return (

    <div
      className="
        flex
        items-center
        justify-between
        gap-4
      "
    >

      <span
        className="
          text-sm
          text-muted
        "
      >
        {label}
      </span>

      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(
            value
          );
        }}
        className="
          flex
          items-center
          gap-2
          text-sm
          font-medium
        "
      >

        <span
          className="
            max-w-[160px]
            truncate
          "
        >
          {value}
        </span>

        <Copy
          size={16}
        />

      </button>

    </div>

  );

}
