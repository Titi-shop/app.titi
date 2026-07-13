"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import useSWR from "swr";

import {
  useParams,
  useRouter,
} from "next/navigation";

import QRCode from "qrcode";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { useAuth } from "@/context/AuthContext";
import { formatPi } from "@/lib/pi";
import AppLoading from "@/components/AppLoading";

import type { Order } from "./types";

import { getOrder } from "./lib/api";

import Header from "./components/Header";
import Timeline from "./components/Timeline";
import PrintableInvoice from "./components/PrintableInvoice";

/* =========================================================
   HELPERS
========================================================= */

function formatDate(
  value: string
) {
  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? "—"
    : date.toLocaleString();
}
/* =========================================================
   PAGE
========================================================= */

export default function SellerOrderDetailPage() {
  const router = useRouter();

  const params = useParams();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const id =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : "";

  /* =========================================================
     ORDER
  ========================================================= */

  const {
    data: order,
    isLoading,
  } = useSWR<Order | null>(
    !authLoading &&
      user &&
      id
      ? `/api/seller/orders/${id}`
      : null,
    getOrder,
    {
      revalidateOnFocus: false,
    }
  );

  /* =========================================================
     QR CODE
  ========================================================= */

  const [
    qrCode,
    setQrCode,
  ] = useState("");

  useEffect(() => {
    if (!order?.id) return;

    QRCode.toDataURL(
      `order:${order.id}`
    )
      .then(setQrCode)
      .catch(() => {});
  }, [order]);

  /* =========================================================
     TOTAL
  ========================================================= */

  const total =
    useMemo(() => {
      if (!order) return 0;

      if (order.total > 0) {
        return order.total;
      }

      return order.order_items.reduce(
        (sum, item) =>
          sum + item.total_price,
        0
      );
    }, [order]);

  /* =========================================================
     PDF
  ========================================================= */

  const printRef =
    useRef<HTMLDivElement>(null);

  const [
    generating,
    setGenerating,
  ] = useState(false);
    /* =========================================================
     PRINT PDF
  ========================================================= */

  async function handlePrint() {
    try {
      const element = printRef.current;

      if (!element) return;

      setGenerating(true);

      const canvas =
        await html2canvas(element, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });

      const image =
        canvas.toDataURL("image/png");

      const pdf = new jsPDF(
        "p",
        "mm",
        "a4"
      );

      const pageWidth = 210;

      const imageHeight =
        (canvas.height *
          pageWidth) /
        canvas.width;

      pdf.addImage(
        image,
        "PNG",
        0,
        10,
        pageWidth,
        imageHeight
      );

      pdf.save(
        `order-${order?.order_number}.pdf`
      );

    } catch {
      alert(
        "Cannot generate PDF."
      );
    } finally {
      setGenerating(false);
    }
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (
    authLoading ||
    isLoading
  ) {
    return <AppLoading />;
  }

  /* =========================================================
     NOT FOUND
  ========================================================= */

  if (!order) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-lg font-medium text-red-500">
          Order not found.
        </p>
      </main>
    );
  }
    /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="min-h-screen bg-[var(--background)] p-4">

      <Header
        order={order}
        generating={generating}
        onBack={() => router.back()}
        onPrint={handlePrint}
      />

      <div
        ref={printRef}
        className="
          mx-auto
          mt-4
          max-w-4xl
          rounded-3xl
          border
          border-[var(--border-color)]
          bg-[var(--card-bg)]
          p-6
          shadow-sm
        "
      >
        {/* ================= TITLE ================= */}

        <h1 className="mb-5 text-center text-2xl font-bold">
          DELIVERY NOTE
        </h1>

        {/* ================= QR ================= */}

        {qrCode && (
          <div className="mb-6 flex justify-center">
            <img
              src={qrCode}
              alt="QR Code"
              className="h-32 w-32"
            />
          </div>
        )}

        {/* ================= TIMELINE ================= */}

        <Timeline order={order} />

        {/* ================= SUMMARY ================= */}

        <Summary
          order={order}
          total={total}
        />

        {/* ================= ITEMS ================= */}

        <div className="mt-6 overflow-x-auto">

          <table className="w-full border-collapse text-sm">

            <thead>

              <tr className="bg-[var(--surface-2)]">

                <th className="border border-[var(--border-color)] p-2">
                  #
                </th>

                <th className="border border-[var(--border-color)] p-2 text-left">
                  Product
                </th>

                <th className="border border-[var(--border-color)] p-2">
                  Qty
                </th>

                <th className="border border-[var(--border-color)] p-2 text-right">
                  π
                </th>

              </tr>

            </thead>

            <tbody>

              {order.order_items.map(
                (item, index) => (
                  <tr key={item.id}>

                    <td className="border border-[var(--border-color)] p-2 text-center">
                      {index + 1}
                    </td>

                    <td className="border border-[var(--border-color)] p-2">

                      <div className="flex items-center gap-3">

                        {item.thumbnail && (
                          <img
                            src={item.thumbnail}
                            alt={item.product_name}
                            className="h-12 w-12 rounded-lg object-cover"
                          />
                        )}

                        <div>

                          <div className="font-medium">
                            {item.product_name}
                          </div>

                          {(item.variant_name ||
                            item.variant_value) && (
                            <div className="text-xs text-[var(--text-muted)]">
                              {item.variant_name}
                              {item.variant_name &&
                              item.variant_value
                                ? ": "
                                : ""}
                              {item.variant_value}
                            </div>
                          )}

                        </div>

                      </div>

                    </td>

                    <td className="border border-[var(--border-color)] p-2 text-center">
                      {item.quantity}
                    </td>

                    <td className="border border-[var(--border-color)] p-2 text-right">
                      π
                      {formatPi(
                        item.total_price
                      )}
                    </td>

                  </tr>
                )
              )}

            </tbody>

          </table>

        </div>

        <div className="mt-6 text-right text-xl font-bold">
          Total: π{formatPi(total)}
        </div>

      </div>

    </main>
  );
}
