"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import useSWR from "swr";
import {
  Suspense,
  useMemo,
} from "react";

import Link from "next/link";

import { useAuth } from "@/context/AuthContext";

import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

import {
  PackagePlus,
  Package,
  ClipboardList,
  Clock3,
  CheckCircle2,
  Truck,
  PackageCheck,
  RotateCcw,
  XCircle,
  RefreshCcw,
} from "lucide-react";

/* ======================================================
   PAGE
====================================================== */

function SellerOrdersContent() {
  const { t } =
    useTranslation();

  const {
    user,
    loading,
    piReady,
  } = useAuth();

  const isSeller =
    user?.role === "seller";

  /* ======================================================
     FETCHER
  ====================================================== */

  const fetcher = async (
    url: string
  ) => {
    const res =
      await apiAuthFetch(
        url,
        {
          cache:
            "no-store",
        }
      );

    if (!res.ok) {
      return null;
    }

    return res.json();
  };

  /* ======================================================
     SWR
  ====================================================== */

  const {
    data,
    isLoading,
  } = useSWR(
    isSeller &&
      piReady
      ? "/api/seller/orders/count"
      : null,
    fetcher,
    {
      revalidateOnFocus:
        false,

      dedupingInterval:
        5000,

      keepPreviousData:
        true,
    }
  );

  /* ======================================================
     STATS
  ====================================================== */

  const stats = useMemo(() => {
    const pending =
      Number(
        data?.pending ?? 0
      );

    const processing =
      Number(
        data?.processing ??
          0
      );

    const shipped =
      Number(
        data?.shipped ?? 0
      );

    const completed =
      Number(
        data?.completed ??
          0
      );

    const returned =
      Number(
        data?.returned ?? 0
      );

    const cancelled =
      Number(
        data?.cancelled ??
          0
      );

    return {
      pending,
      processing,
      shipped,
      completed,
      returned,
      cancelled,

      total:
        pending +
        processing +
        shipped +
        completed +
        returned +
        cancelled,
    };
  }, [data]);

  /* ======================================================
     LOADING
  ====================================================== */

  if (
    loading ||
    !piReady ||
    isLoading
  ) {
    return (
      <main
        className="
          min-h-screen
          px-4
          py-6
          space-y-4
        "
        style={{
          backgroundColor:
            "var(--background)",
        }}
      >
        {Array.from({
          length: 6,
        }).map(
          (_, i) => (
            <div
              key={i}
              className="
                h-24
                animate-pulse
                rounded-3xl
              "
              style={{
                backgroundColor:
                  "var(--card-bg)",
              }}
            />
          )
        )}
      </main>
    );
  }

  /* ======================================================
     NO PERMISSION
  ====================================================== */

  if (!isSeller) {
    return (
      <main
        className="
          flex
          min-h-screen
          items-center
          justify-center
          px-4
        "
        style={{
          backgroundColor:
            "var(--background)",
        }}
      >
        <div
          className="
            rounded-3xl
            px-6
            py-5
            text-center
          "
          style={{
            backgroundColor:
              "var(--card-bg)",
          }}
        >
          <p
            className="
              text-sm
            "
            style={{
              color:
                "var(--muted-foreground)",
            }}
          >
            {t.no_permission ??
              "No permission"}
          </p>
        </div>
      </main>
    );
  }

  /* ======================================================
     UI
  ====================================================== */

  return (
    <main
      className="
        min-h-screen
        px-4
        py-5
        pb-10
        space-y-6
      "
      style={{
        backgroundColor:
          "var(--background)",
      }}
    >
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div
        className="
          rounded-3xl
          p-5
          shadow-sm
        "
        style={{
          background:
            "linear-gradient(135deg,var(--primary),var(--primary-dark))",
        }}
      >
        <p
          className="
            text-xs
            uppercase
            tracking-widest
            text-white/70
          "
        >
          {t.order_status ??
            "ORDER STATUS"}
        </p>

        <h1
          className="
            mt-2
            text-2xl
            font-bold
            text-white
          "
        >
          {t.all_orders ??
            "Orders"}
        </h1>

        <p
          className="
            mt-2
            text-sm
            text-white/80
          "
        >
          {stats.total}{" "}
          {t.total_orders ??
            "total orders"}
        </p>
      </div>

      {/* ======================================================
          MAIN ACTIONS
      ====================================================== */}

      <section
        className="
          grid
          grid-cols-2
          gap-4
        "
      >
        <MainCard
          href="/seller/post"
          icon={
            <PackagePlus
              size={20}
            />
          }
          label={
            t.post_product ??
            "Post Product"
          }
        />

        <MainCard
          href="/seller/stock"
          icon={
            <Package
              size={20}
            />
          }
          label={
            t.stock ??
            "Stock"
          }
        />

        <MainCard
          href="/seller/orders"
          icon={
            <ClipboardList
              size={20}
            />
          }
          label={
            t.all_orders ??
            "All Orders"
          }
          badge={stats.total}
        />

        <MainCard
          href="/seller/returns"
          icon={
            <RefreshCcw
              size={20}
            />
          }
          label={
            t.returns ??
            "Returns"
          }
          badge={
            stats.returned
          }
        />
      </section>

      {/* ======================================================
          STATUS SECTION
      ====================================================== */}

      <section className="space-y-4">
        <div
          className="
            flex
            items-center
            justify-between
          "
        >
          <h2
            className="
              text-sm
              font-semibold
            "
            style={{
              color:
                "var(--foreground)",
            }}
          >
            {t.order_status ??
              "Order Status"}
          </h2>
        </div>

        <div
          className="
            grid
            grid-cols-2
            gap-4
            sm:grid-cols-3
          "
        >
          <StatusCard
            href="/seller/orders?tab=pending"
            icon={
              <Clock3
                size={18}
              />
            }
            count={
              stats.pending
            }
            label={
              t.pending_orders ??
              "Pending"
            }
          />

          <StatusCard
            href="/seller/orders?tab=processing"
            icon={
              <CheckCircle2
                size={18}
              />
            }
            count={
              stats.processing
            }
            label={
              t.confirmed_orders ??
              "Processing"
            }
          />

          <StatusCard
            href="/seller/orders?tab=shipped"
            icon={
              <Truck
                size={18}
              />
            }
            count={
              stats.shipped
            }
            label={
              t.shipping_orders ??
              "Shipping"
            }
          />

          <StatusCard
            href="/seller/orders?tab=completed"
            icon={
              <PackageCheck
                size={18}
              />
            }
            count={
              stats.completed
            }
            label={
              t.completed_orders ??
              "Completed"
            }
          />

          <StatusCard
            href="/seller/orders?tab=returned"
            icon={
              <RotateCcw
                size={18}
              />
            }
            count={
              stats.returned
            }
            label={
              t.returned_orders ??
              "Returned"
            }
          />

          <StatusCard
            href="/seller/orders?tab=cancelled"
            icon={
              <XCircle
                size={18}
              />
            }
            count={
              stats.cancelled
            }
            label={
              t.cancelled_orders ??
              "Cancelled"
            }
          />
        </div>
      </section>
    </main>
  );
}

/* ======================================================
   MAIN CARD
====================================================== */

function MainCard({
  href,
  icon,
  label,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="block"
    >
      <div
        className="
          relative
          flex
          h-[110px]
          flex-col
          items-center
          justify-center
          rounded-3xl
          border
          transition-all
          duration-200
          active:scale-[0.98]
        "
        style={{
          backgroundColor:
            "var(--card-bg)",

          borderColor:
            "var(--border)",
        }}
      >
        {badge !==
          undefined &&
          badge > 0 && (
            <span
              className="
                absolute
                right-3
                top-3
                rounded-full
                px-2
                py-0.5
                text-[10px]
                font-semibold
                text-white
              "
              style={{
                backgroundColor:
                  "var(--primary)",
              }}
            >
              {badge}
            </span>
          )}

        <div
          className="
            flex
            h-11
            w-11
            items-center
            justify-center
            rounded-2xl
          "
          style={{
            backgroundColor:
              "var(--soft-bg)",

            color:
              "var(--foreground)",
          }}
        >
          {icon}
        </div>

        <span
          className="
            mt-3
            px-2
            text-center
            text-xs
            font-medium
            leading-tight
          "
          style={{
            color:
              "var(--foreground)",
          }}
        >
          {label}
        </span>
      </div>
    </Link>
  );
}

/* ======================================================
   STATUS CARD
====================================================== */

function StatusCard({
  href,
  icon,
  count,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  count: number;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="block"
    >
      <div
        className="
          flex
          h-[128px]
          flex-col
          items-center
          justify-between
          rounded-3xl
          border
          p-4
          transition-all
          duration-200
          active:scale-[0.98]
        "
        style={{
          backgroundColor:
            "var(--card-bg)",

          borderColor:
            "var(--border)",
        }}
      >
        <div
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-2xl
          "
          style={{
            backgroundColor:
              "var(--soft-bg)",

            color:
              "var(--foreground)",
          }}
        >
          {icon}
        </div>

        <span
          className="
            px-1
            text-center
            text-[11px]
            leading-tight
          "
          style={{
            color:
              "var(--muted-foreground)",
          }}
        >
          {label}
        </span>

        <span
          className="
            text-lg
            font-bold
          "
          style={{
            color:
              "var(--foreground)",
          }}
        >
          {count}
        </span>
      </div>
    </Link>
  );
}

/* ======================================================
   EXPORT
====================================================== */

export default function SellerOrdersPage() {
  return (
    <Suspense
      fallback={
        <main
          className="
            min-h-screen
            space-y-4
            p-4
          "
          style={{
            backgroundColor:
              "var(--background)",
          }}
        >
          {Array.from({
            length: 4,
          }).map(
            (_, i) => (
              <div
                key={i}
                className="
                  h-28
                  animate-pulse
                  rounded-3xl
                "
                style={{
                  backgroundColor:
                    "var(--card-bg)",
                }}
              />
            )
          )}
        </main>
      }
    >
      <SellerOrdersContent />
    </Suspense>
  );
}
