"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";
import useSWR from "swr";
import type { Product } from "@/types/Product";
import type {
  Region,
  ShippingInfo,
  PreviewPayload,
  PreviewResponse,
} from "./checkout.types";

const previewFetcher = async (
  [url, payload]: [string, PreviewPayload]
): Promise<PreviewResponse> => {
  const token = await getPiAccessToken();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data?.error || "PREVIEW_FAILED");

  return data;
};

export function useCheckout(product: Product & { variant_id?: string | null }, open: boolean, t: any) {
  const router = useRouter();
  const { user, piReady, pilogin } = useAuth();

  const processingRef = useRef(false);

  const [shipping, setShipping] = useState<ShippingInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [qtyDraft, setQtyDraft] = useState("1");
  const [zone, setZone] = useState<Region | null>(null);

  /* ================= ITEM ================= */

  const item = useMemo(() => {
    if (!product) return null;
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      finalPrice: product.finalPrice,
      thumbnail: product.thumbnail || "/placeholder.png",
      stock: product.stock ?? 1,
    };
  }, [product]);

  const maxStock = Math.max(1, item?.stock ?? 0);

  const quantity = useMemo(() => {
    const n = Number(qtyDraft);
    return Number.isInteger(n) && n >= 1 && n <= maxStock ? n : 1;
  }, [qtyDraft, maxStock]);

  /* ================= PREVIEW ================= */

  const previewKey =
    open && shipping?.country && zone && item
      ? [
          "/api/orders/preview",
          {
            country: shipping.country.toUpperCase(),
            zone,
            items: [{ product_id: item.id, quantity }],
          },
        ]
      : null;

  const { data: preview, isLoading: previewLoading } = useSWR(
    previewKey,
    previewFetcher
  );

  /* ================= ADDRESS ================= */

  useEffect(() => {
    if (!open || !user) return;

    (async () => {
      try {
        const token = await getPiAccessToken();
        const res = await fetch("/api/address", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        const def = data.items?.find((a: any) => a.is_default);

        if (!def) return;

        setShipping({
          name: def.full_name,
          phone: def.phone,
          address_line: def.address_line,
          province: def.province,
          country: def.country,
          postal_code: def.postal_code ?? null,
        });
      } catch {
        setShipping(null);
      }
    })();
  }, [open, user]);

  /* ================= REGION ================= */

  const availableRegions = useMemo(() => {
    if (!shipping?.country) return [];

    const country = shipping.country.toUpperCase();

    return product.shippingRates.filter((r: any) => {
      if (country === "VN") return r.zone === "domestic";
      return true;
    });
  }, [shipping?.country, product.shippingRates]);

  /* ================= PRICE ================= */

  const unitPrice =
    typeof item?.finalPrice === "number" ? item.finalPrice : item?.price ?? 0;

  const total = preview?.total ?? unitPrice * quantity;

  /* ================= PAY ================= */

  const handlePay = useCallback(async () => {
    if (!user) {
      localStorage.setItem("pending_checkout", "1");
      pilogin?.();
      return;
    }

    if (!preview || processingRef.current) return;

    processingRef.current = true;
    setProcessing(true);

    await window.Pi?.createPayment(
      {
        amount: total,
        memo: "Order payment",
        metadata: { shipping, zone, product: item, quantity },
      },
      {
        onReadyForServerApproval: async (paymentId, callback) => {
          const token = await getPiAccessToken();

          await fetch("/api/pi/approve", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ paymentId }),
          });

          callback();
        },

        onReadyForServerCompletion: async (paymentId, txid) => {
          const token = await getPiAccessToken();

          await fetch("/api/pi/complete", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              paymentId,
              txid,
              product_id: item!.id,
              variant_id: product.variant_id ?? null,
              quantity,
              shipping,
              zone,
            }),
          });

          processingRef.current = false;
          setProcessing(false);
          router.push("/customer/pending");
        },
      }
    );
  }, [user, preview, total, item, shipping, zone, quantity]);

  return {
    item,
    quantity,
    qtyDraft,
    setQtyDraft,
    maxStock,

    shipping,
    zone,
    setZone,
    availableRegions,

    preview,
    previewLoading,

    total,
    processing,

    handlePay,
  };
}
