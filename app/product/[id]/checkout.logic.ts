"use client";

import { useCallback, useRef } from "react";
import { getPiAccessToken } from "@/lib/piAuth";
import type { ShippingInfo, Region } from "./checkout.types";

/* =========================
   TYPES
========================= */

type Item = {
  id: string;
  name: string;
  thumbnail?: string;
  stock: number;
};

type PreviewPayload = {
  shipping: ShippingInfo;
  zone: Region;
  item: Item;
  quantity: number;
  variant_id?: string | null;
};

type ValidateParams = {
  user: unknown;
  piReady: boolean;
  shipping: ShippingInfo | null;
  zone: Region | null;
  item: Item | null;
  quantity: number;
  maxStock: number;
  pilogin?: () => void;
  showMessage: (text: string) => void;
  t: Record<string, string>;
};

type UseCheckoutPayParams = {
  item: Item | null;
  quantity: number;
  total: number;
  shipping: ShippingInfo | null;
  unitPrice: number;
  processing: boolean;
  setProcessing: (v: boolean) => void;
  processingRef: { current: boolean };
  t: Record<string, string>;
  user: unknown;
  router: {
    push: (path: string) => void;
    replace: (path: string) => void;
  };
  onClose: () => void;
  zone: Region | null;
  product: { variant_id?: string | null };
  showMessage: (text: string, type?: "error" | "success") => void;
  validate: () => boolean;
  preview: { total: number } | null;
};

type PaymentIntentResponse = {
  paymentIntentId: string;
  amount: number;
  memo: string;
};

type ApiError = {
  error?: string;
};

declare global {
  interface Window {
    Pi?: {
      createPayment: (
        data: {
          amount: number;
          memo: string;
          metadata: {
            payment_intent_id: string;
          };
        },
        callbacks: {
          onReadyForServerApproval: (
            paymentId: string,
            callback: () => void
          ) => void | Promise<void>;
          onReadyForServerCompletion: (
            paymentId: string,
            txid: string,
            callback: () => void
          ) => void | Promise<void>;
          onCancel: () => void;
          onError: (error: unknown) => void;
        }
      ) => void;
    };
  }
}

/* =========================
   PREVIEW DIRECT
========================= */

async function previewOrderDirect({
  shipping,
  zone,
  item,
  quantity,
  variant_id,
}: PreviewPayload): Promise<{ total: number }> {
  const token = await getPiAccessToken();

  const res = await fetch("/api/orders/preview", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      country: shipping.country.toUpperCase(),
      zone,
      shipping: {
        region: shipping.region,
        district: shipping.district,
        ward: shipping.ward,
      },
      items: [
        {
          product_id: item.id,
          variant_id: variant_id ?? null,
          quantity,
        },
      ],
    }),
  });

  const data = (await res.json().catch(() => null)) as ApiError | null;

  if (!res.ok) {
    throw new Error(data?.error || "PREVIEW_FAILED");
  }

  return data as { total: number };
}

/* =========================
   ERROR MAP
========================= */

export const getErrorKey = (code?: string): string => {
  const map: Record<string, string> = {
    UNSUPPORTED_COUNTRY: "unsupported_country",
    PREVIEW_FAILED: "order_preview_failed",
    INVALID_REGION: "invalid_region",
    SHIPPING_NOT_AVAILABLE: "shipping_not_available",
    OUT_OF_STOCK: "error_out_of_stock",
    INVALID_QUANTITY: "error_invalid_quantity",
    PI_APPROVE_FAILED: "payment_approve_failed",
    PI_COMPLETE_FAILED: "payment_complete_failed",
    INVALID_TXID: "payment_invalid_txid",
    SUBMIT_FAILED: "payment_submit_failed",
  };

  return map[code || ""] || "unknown_error";
};

/* =========================
   VALIDATE
========================= */

export function validateBeforePay({
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
}: ValidateParams): boolean {
  if (!user) {
    localStorage.setItem("pending_checkout", "1");
    pilogin?.();
    showMessage(t.please_login ?? "please_login");
    return false;
  }

  if (!piReady) {
    showMessage(t.pi_not_ready ?? "pi_not_ready");
    return false;
  }

  if (!shipping) {
    showMessage(t.please_add_shipping_address ?? "no_address");
    return false;
  }

  if (!shipping.country || !shipping.region || !zone) {
    showMessage(t.shipping_required ?? "shipping_required");
    return false;
  }

  if (!item?.id) {
    showMessage(t.invalid_product ?? "invalid_product");
    return false;
  }

  if (quantity < 1 || quantity > maxStock || item.stock <= 0) {
    showMessage(t.invalid_quantity ?? "invalid_quantity");
    return false;
  }

  return true;
}

/* =========================
   MAIN PAY HOOK
========================= */

export function useCheckoutPay({
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
  validate,
  preview,
}: UseCheckoutPayParams) {
  const completionLockRef = useRef(false);

  return useCallback(async () => {
    if (processingRef.current || processing) return;
    if (!validate()) return;

    processingRef.current = true;
    completionLockRef.current = false;
    setProcessing(true);

    try {
      let finalPreview = preview;

      if (!finalPreview && shipping && zone && item) {
        finalPreview = await previewOrderDirect({
          shipping,
          zone,
          item,
          quantity,
          variant_id: product.variant_id ?? null,
        });
      }

      const token = await getPiAccessToken();

      const intentRes = await fetch("/api/payments/pi/create-intent", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: item?.id,
          variant_id: product.variant_id ?? null,
          quantity,
          country: shipping?.country,
          zone,
          shipping: {
            name: shipping?.name,
            phone: shipping?.phone,
            address_line: shipping?.address_line,
            ward: shipping?.ward,
            district: shipping?.district,
            region: shipping?.region,
            postal_code: shipping?.postal_code,
          },
        }),
      });

      const intentData = (await intentRes.json().catch(() => null)) as
        | PaymentIntentResponse
        | ApiError
        | null;

      if (!intentRes.ok || !intentData || !("paymentIntentId" in intentData)) {
        showMessage(t.payment_intent_failed ?? "payment_intent_failed");
        throw new Error(
          (intentData as ApiError | null)?.error || "PAYMENT_INTENT_FAILED"
        );
      }

      const paymentIntentId = intentData.paymentIntentId;
      const lockedAmount = Number(Number(intentData.amount || 0).toFixed(7));
      const lockedMemo =
        typeof intentData.memo === "string" && intentData.memo.trim()
          ? intentData.memo.trim().slice(0, 120)
          : (t.payment_memo_order ?? "Order payment");

      console.log("🟢 [CHECKOUT_V2] INTENT_OK", {
        paymentIntentId,
        lockedAmount,
        lockedMemo,
      });

      if (!window.Pi) {
        throw new Error("PI_SDK_NOT_READY");
      }

      window.Pi.createPayment(
        {
          amount: lockedAmount,
          memo: lockedMemo,
          metadata: {
            payment_intent_id: paymentIntentId,
          },
        },
        {
          onReadyForServerApproval: async (paymentId, callback) => {
            const tokenApprove = await getPiAccessToken();

            const res = await fetch("/api/payments/pi/authorize", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${tokenApprove}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                payment_intent_id: paymentIntentId,
                pi_payment_id: paymentId,
              }),
            });

            const data = (await res.json().catch(() => null)) as ApiError | null;

            if (!res.ok) {
              const key = getErrorKey(data?.error);
              showMessage(t[key] ?? data?.error ?? "approve_failed");
              throw new Error(data?.error || "AUTHORIZE_FAILED");
            }

            console.log("🟢 [CHECKOUT_V2] AUTHORIZE_OK");
            callback();
          },

          onReadyForServerCompletion: async (paymentId, txid, callback) => {
            if (completionLockRef.current) {
              console.warn("🟠 [CHECKOUT_V2] DUPLICATE_COMPLETION_BLOCKED");
              return;
            }

            completionLockRef.current = true;

            try {
              const tokenSubmit = await getPiAccessToken();

              const res = await fetch("/api/payments/pi/submit", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${tokenSubmit}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  payment_intent_id: paymentIntentId,
                  pi_payment_id: paymentId,
                  txid,
                }),
              });

              const data = (await res.json().catch(() => null)) as ApiError | null;

              if (!res.ok) {
                const key = getErrorKey(data?.error);
                showMessage(t[key] ?? data?.error ?? "submit_failed");
                processingRef.current = false;
                setProcessing(false);
                return;
              }

              console.log("🟢 [CHECKOUT_V2] SUBMIT_OK_SERVER_OWNS_RECONCILE");

              callback();

              onClose();
              router.replace("/customer/orders?tab=pending");
              showMessage(t.payment_success ?? "success", "success");
            } catch (err) {
              console.error("🔥 [CHECKOUT_V2] COMPLETION_FAIL", err);
              showMessage(t.transaction_failed ?? "transaction_failed");
              processingRef.current = false;
              setProcessing(false);
            }
          },

          onCancel: () => {
            processingRef.current = false;
            setProcessing(false);
            showMessage(t.payment_cancelled ?? "cancelled");
          },

          onError: (err) => {
            console.error("🔥 [CHECKOUT_V2] PI_SDK_ERROR", err);
            processingRef.current = false;
            setProcessing(false);
            showMessage(t.payment_failed ?? "payment_failed");
          },
        }
      );
    } catch (err) {
      console.error("🔥 [CHECKOUT_V2] PAY_ERROR", err);
      processingRef.current = false;
      setProcessing(false);
      showMessage(t.transaction_failed ?? "transaction_failed");
    }
  }, [
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
    product.variant_id,
    preview,
    validate,
    showMessage,
  ]);
}
