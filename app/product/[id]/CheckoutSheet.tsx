"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";

import type { ShippingRate } from "@/types/Product";
import type {
  CheckoutProps as Props,
  Region,
  ShippingInfo,
  Message,
} from "@/types/checkout";

import {
  previewFetcher,
  fetchDefaultAddress,
  getCountryDisplay,
} from "./checkout.api";

import {
  validateBeforePay,
  useCheckoutPay,
} from "./checkout.logic";

/* =========================================================
ZONE LABEL ENGINE
========================================================= */

function getZoneLabel(zone: Region | null, country?: string) {
  if (!zone) return "Unknown";

  const c = country?.toUpperCase();

  switch (zone) {
    case "domestic":
      return c ? `Domestic (${c})` : "Domestic";

    case "asia":
      return "Asia";

    case "europe":
      return "Europe";

    case "north_america":
      return "North America";

    case "sea":
      return "Southeast Asia";

    case "rest_of_world":
      return "Global";

    default:
      return zone;
  }
}

/* =========================================================
DETECT ZONE
========================================================= */

function detectZone(country: string, rates: ShippingRate[]): Region | null {
  if (!country || !rates?.length) return null;

  const c = country.toUpperCase();

  // 1. match exact country code (IMPORTANT)
  const exact = rates.find(
    (r) =>
      r.domestic_country_code?.toUpperCase() === c ||
      r.country_code?.toUpperCase() === c
  );

  if (exact) return exact.zone as Region;
  const priority =
    rates.find(r => r.zone === "domestic") ||
    rates.find(r => r.zone === "asia") ||
    rates.find(r => r.zone === "sea") ||
    rates.find(r => r.zone === "rest_of_world");

  return (priority?.zone as Region) ?? null;
}

/* =========================================================
COMPONENT
========================================================= */

export default function CheckoutSheet({
  open,
  onClose,
  product,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, piReady, pilogin } = useAuth();

  const processingRef = useRef(false);

  /* ================= STATE ================= */

  const [shipping, setShipping] = useState<ShippingInfo | null>(null);
  const [zone, setZone] = useState<Region | null>(null);
  const [qty, setQty] = useState("1");
  const [message, setMessage] = useState<Message | null>(null);
  const [processing, setProcessing] = useState(false);

  /* ================= ITEM ================= */

  const item = useMemo(() => {
    if (!product) return null;

    const v = product.selectedVariant;

    const price =
      v?.final_price ??
      v?.sale_price ??
      v?.price ??
      product.final_price ??
      product.price;

    return {
      id: product.id,
      name: product.name,
      price,
      final_price: price,
      thumbnail: product.thumbnail || "/placeholder.png",
      stock: v?.stock ?? product.stock ?? 0,
    };
  }, [product]);

  const maxStock = Math.max(1, item?.stock ?? 0);

  const quantity = useMemo(() => {
    const n = Number(qty);
    return Number.isInteger(n) && n >= 1 && n <= maxStock ? n : 1;
  }, [qty, maxStock]);

  /* ================= SHIPPING ================= */

  const regions = useMemo(() => {
    return Array.isArray(product?.shipping_rates)
      ? product.shipping_rates
      : [];
  }, [product?.shipping_rates]);

  /* ================= LOAD ADDRESS ================= */

  useEffect(() => {
    if (!open || !user) return;

    (async () => {
      const def = await fetchDefaultAddress();
      if (!def) return;

      setShipping(def);

      const z = detectZone(def.country, regions);

      setZone(z ?? regions[0]?.zone ?? null);
    })();
  }, [open, user, regions]);

  /* ================= SWR PREVIEW ================= */

  const previewKey = useMemo(() => {
    if (!open || !shipping || !zone || !item) return null;

    return [
      "/api/orders/preview",
      shipping.id,
      zone,
      quantity,
      item.id,
      product?.selectedVariant?.id ?? null,
    ];
  }, [open, shipping, zone, quantity, item, product]);

  const { data: preview, isLoading, isValidating } = useSWR(
    previewKey,
    previewFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  );

  /* ================= PRICE ================= */

  const unitPrice = item?.final_price ?? 0;

  const total = useMemo(() => {
    if (preview?.total != null) return preview.total;
    return unitPrice * quantity;
  }, [preview?.total, unitPrice, quantity]);

  /* ================= MESSAGE ================= */

  const showMessage = (text: string, type: "error" | "success" = "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  /* ================= PAY ================= */

  const handlePay = useCheckoutPay({
    item,
    quantity,
    total,
    shipping,
    unitPrice,
    processing,
    setProcessing,
    processingRef,
    t,
    user,
    router,
    onClose,
    zone,
    product,
    showMessage,
    validate: () =>
      validateBeforePay({
        user,
        piReady,
        shipping,
        zone,
        item,
        quantity,
        maxStock,
        pilogin,
        showMessage,
        t,
      }),
  });

  /* ================= GUARD ================= */

  if (!open || !item) return null;

 const resolvedRegion = useMemo(() => {
  if (!shipping || !availableRegions.length) return null;

  const country = shipping.country?.toUpperCase();

  // 1. match exact country first
  const exact = availableRegions.find(
    (r) =>
      r.domestic_country_code?.toUpperCase() === country ||
      r.country_code?.toUpperCase() === country
  );

  if (exact) return exact;

  // 2. fallback: match selected zone
  const byZone = availableRegions.find((r) => r.zone === zone);

  return byZone ?? null;
}, [shipping, availableRegions, zone]);
  /* ================= RENDER ================= */

  return (
    <div className="fixed inset-0 z-[100]">

      {/* MESSAGE */}
      {message && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-white z-[120]
          ${message.type === "success" ? "bg-green-600" : "bg-red-500"}`}
        >
          {message.text}
        </div>
      )}

      {/* OVERLAY */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* SHEET */}
      <div className="absolute bottom-0 left-0 right-0 h-[65vh] rounded-t-2xl flex flex-col bg-white">

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ADDRESS */}
          <div
            className="border rounded-xl p-3 cursor-pointer"
            onClick={() => router.push("/customer/address")}
          >
            {shipping ? (
              <>
                <p className="font-medium">{shipping.name}</p>
                <p className="text-sm text-gray-500">{shipping.phone}</p>
                <p className="text-sm text-gray-500">
                  {shipping.address_line}
                </p>
                <p className="text-sm text-gray-500">
                  {[shipping.ward, shipping.district, shipping.region]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  – {getCountryDisplay(shipping.country)}
                </p>
              </>
            ) : (
              <p className="text-gray-400">➕ {t.add_shipping}</p>
            )}
          </div>

          {/* SHIPPING ZONE */}
          <div className="border rounded-xl p-3">
            <p className="font-medium mb-2">🌍 Shipping zone</p>

            {!zone ? (
              <p className="text-red-500 text-sm">
                No shipping zone available
              </p>
            ) : (
              <>
                <div className="text-sm font-semibold">
           {resolvedRegion ? (
  <div>
    <div className="font-semibold">
      {getZoneLabel(resolvedRegion.zone, shipping?.country)}
    </div>

    <div className="text-xs opacity-70">
      {getCountryDisplay(shipping?.country)} • {resolvedRegion.domestic_country_code || resolvedRegion.country_code || "N/A"}
    </div>
  </div>
) : (
  "Unknown region"
)}
</div>

                <div className="text-xs mt-1 opacity-70">
  {resolvedRegion
    ? `${getZoneLabel(
        resolvedRegion.zone,
        shipping?.country
      )} · ${formatPi(resolvedRegion.price)} π`
    : "No rate"}
</div>
              </>
            )}
          </div>

          {/* PRODUCT */}
          <div className="flex items-center gap-3">

            <img
              src={item.thumbnail || "/placeholder.png"}
              className="w-16 h-16 rounded-lg object-cover border"
              style={{ borderColor: "var(--nav-border)" }}
              alt={item.name}
            />

            <div className="flex-1">
              <p className="font-medium line-clamp-2">
                {item.name}
              </p>

              <div className="flex items-center gap-2 mt-2">

                <button
                  type="button"
                  onClick={() => setQty(String(Math.max(1, quantity - 1)))}
                  disabled={quantity <= 1}
                  className="w-8 h-8 border rounded-lg disabled:opacity-30"
                >
                  -
                </button>

                <input
                  value={qty}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    if (!val) return setQty("");
                    if (Number(val) > maxStock) return;
                    setQty(val);
                  }}
                  onBlur={() => {
                    const v = Number(qty || "0");
                    if (v < 1) setQty("1");
                    else if (v > maxStock) setQty(String(maxStock));
                  }}
                  className="w-12 text-center border rounded-lg text-sm"
                />

                <button
                  type="button"
                  onClick={() =>
                    setQty(String(Math.min(maxStock, quantity + 1)))
                  }
                  disabled={quantity >= maxStock}
                  className="w-8 h-8 border rounded-lg disabled:opacity-30"
                >
                  +
                </button>

              </div>
            </div>

            <div className="text-right font-bold text-red-500">
              {formatPi(total)} π
              {(isLoading || isValidating) && (
                <p className="text-xs text-gray-400">Updating...</p>
              )}
            </div>

          </div>

        </div>

        {/* FOOTER */}
        <div className="border-t p-4">
          <button
            onClick={() => handlePay?.()}
            disabled={processing}
            className="w-full py-3 rounded-xl bg-orange-500 text-white font-bold disabled:opacity-50"
          >
            {processing ? t.processing : t.pay_now}
          </button>
        </div>

      </div>
    </div>
  );
}
