"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { useRouter } from "next/navigation";
import useSWR from "swr";

import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import { formatPi } from "@/lib/pi";

import type {
  ShippingRate,
} from "@/types/Product";

import type {
  Props,
  Region,
  ShippingInfo,
  Message,
} from "./checkout.types";

import {
  previewFetcher,
  fetchDefaultAddress,
  getCountryDisplay,
} from "./checkout.api";

import {
  getErrorKey,
  validateBeforePay,
  useCheckoutPay,
} from "./checkout.logic";

/* =========================================================
   HELPERS
========================================================= */

function detectInitialZone(
  shippingCountry: string,
  rates: ShippingRate[]
): Region | null {
  if (
    !shippingCountry ||
    !Array.isArray(rates)
  ) {
    return null;
  }

  const buyer =
    shippingCountry.toUpperCase();

  const domestic = rates.find(
    (r) =>
      r.zone === "domestic" &&
      r.domestic_country_code?.toUpperCase() ===
        buyer
  );

  if (domestic) {
    return "domestic";
  }

  return null;
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

  const {
    user,
    piReady,
    pilogin,
  } = useAuth();

  const processingRef =
    useRef(false);

  /* =========================================================
     STATE
  ========================================================= */

  const [shipping, setShipping] =
    useState<ShippingInfo | null>(
      null
    );

  const [processing, setProcessing] =
    useState(false);

  const [qtyDraft, setQtyDraft] =
    useState("1");

  const [message, setMessage] =
    useState<Message | null>(null);

  const [zone, setZone] =
    useState<Region | null>(null);

  /* =========================================================
     DEBUG
  ========================================================= */

  useEffect(() => {
    if (
      process.env.NODE_ENV ===
      "development"
    ) {
      console.log(
        "[CHECKOUT PRODUCT]",
        product
      );

      console.log(
        "[CHECKOUT SHIPPING RATES]",
        product?.shipping_rates
      );
    }
  }, [product]);

  /* =========================================================
     MESSAGE
  ========================================================= */
const showMessage = (
  text: string,
  type: "error" | "success" = "error"
) => {
  console.log(
    "[CHECKOUT MESSAGE]",
    text,
    type
  );

  setMessage({
    text,
    type,
  });

  setTimeout(() => {
    setMessage(null);
  }, 4000);
};

  /* =========================================================
     ITEM
  ========================================================= */

  const item = useMemo(() => {
    if (!product) {
      return null;
    }

    const selected =
      product.selectedVariant;

    /* ================= VARIANT ================= */

    if (selected) {
      const price =
        selected.final_price ??
        selected.sale_price ??
        selected.price;

      return {
        id: product.id,

        name: product.name,

        price,

        final_price: price,

        thumbnail:
          product.thumbnail ||
          "/placeholder.png",

        stock:
          selected.stock ?? 0,
      };
    }

    /* ================= PRODUCT ================= */

    const price =
      typeof product.final_price ===
      "number"
        ? product.final_price
        : product.sale_price &&
          product.sale_price > 0
        ? product.sale_price
        : product.price;

    return {
      id: product.id,

      name: product.name,

      price,

      final_price: price,

      thumbnail:
        product.thumbnail ||
        "/placeholder.png",

      stock:
        product.stock ?? 0,
    };
  }, [product]);

  /* =========================================================
     STOCK
  ========================================================= */

  const maxStock = Math.max(
    1,
    item?.stock ?? 0
  );

  const quantity = useMemo(() => {
    const n = Number(qtyDraft);

    return Number.isInteger(n) &&
      n >= 1 &&
      n <= maxStock
      ? n
      : 1;
  }, [qtyDraft, maxStock]);

  /* =========================================================
     SHIPPING RATES
  ========================================================= */

  const availableRegions =
    useMemo<ShippingRate[]>(() => {
      return Array.isArray(
        product?.shipping_rates
      )
        ? product.shipping_rates
        : [];
    }, [product?.shipping_rates]);

  /* =========================================================
     PREVIEW KEY
  ========================================================= */

const previewKey = useMemo(() => {
  if (!open || !shipping || !zone || !item) {
    console.log("[PREVIEW] SKIP KEY - missing data", {
      open,
      shipping,
      zone,
      item,
    });
    return null;
  }

  const key = {
    url: "/api/orders/preview",
    payload: {
      address_id: shipping.id,
      country: shipping.country?.toUpperCase(),
      zone,
      shipping: {
        region: shipping.region,
        district: shipping.district ?? "",
        ward: shipping.ward ?? "",
      },
      items: [
        {
          product_id: item.id,
          variant_id: product?.selectedVariant?.id ?? null,
          quantity,
        },
      ],
    },
  };

  console.log("[PREVIEW KEY CREATED]", key);

  return key;
}, [
  open,
  shipping?.id,
  shipping?.country,
  shipping?.region,
  shipping?.district,
  shipping?.ward,
  zone,
  item?.id,
  quantity,
  product?.selectedVariant?.id,
]);
  /* =========================================================
     PREVIEW
  ========================================================= */

  const {
  data: preview,
  error: previewError,
  isLoading,
  isValidating,
} = useSWR(previewKey, previewFetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 2000,
  onSuccess: (data) => {
    console.log("[PREVIEW SUCCESS]", data);
  },
  onError: (err) => {
    console.error("[PREVIEW ERROR]", err);
  },
});

  /* =========================================================
     LOAD ADDRESS
  ========================================================= */

  useEffect(() => {
    async function loadAddress() {
      const def =
        await fetchDefaultAddress();

      if (!def) {
        return;
      }

      setShipping(def);

      const autoZone =
        detectInitialZone(
          def.country,
          availableRegions
        );

      if (autoZone) {
        setZone(autoZone);
      } else if (
        availableRegions.length > 0
      ) {
        setZone(
          availableRegions[0]
            .zone as Region
        );
      }
    }

    if (!open || !user) {
      return;
    }

    loadAddress();
  }, [
    open,
    user,
    availableRegions,
  ]);

  /* =========================================================
     ERROR
  ========================================================= */

  useEffect(() => {
    if (!previewError) {
      return;
    }

    const key =
      getErrorKey(
        previewError.message
      );

    showMessage(
      t[key] ?? key
    );
  }, [previewError, t]);

  /* =========================================================
     PRICE
  ========================================================= */

  const unitPrice =
    item?.final_price ?? 0;

  const total =
    preview?.total ??
    unitPrice * quantity;

  /* =========================================================
     VALIDATE
  ========================================================= */

  const validate = () =>
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
    });

  /* =========================================================
     PAY
  ========================================================= */

  const handlePay =
    useCheckoutPay({
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
    });

  /* =========================================================
     GUARD
  ========================================================= */

  if (
    !open ||
    !item ||
    !item.id
  ) {
    return null;
  }

  /* =========================================================
     LABELS
  ========================================================= */

  const labelMap: Record<
    string,
    string
  > = {
    domestic:
      t.region_domestic ??
      "Domestic",

    sea:
      t.region_sea ?? "Sea",

    asia:
      t.region_asia ?? "Asia",

    europe:
      t.region_europe ??
      "Europe",

    north_america:
      t.region_us ??
      "North America",

    rest_of_world:
      t.region_global ??
      "Global",
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="fixed inset-0 z-[100]">
      {/* MESSAGE */}

      {message && (
        <div
          className={`
            fixed top-16 left-1/2 -translate-x-1/2
            px-4 py-2 rounded-lg text-white z-[120]
            ${
              message.type ===
              "success"
                ? "bg-green-600"
                : "bg-red-500"
            }
          `}
        >
          {message.text}
        </div>
      )}

      {/* OVERLAY */}

      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* SHEET */}

      <div
        className="
          absolute bottom-0 left-0 right-0
          rounded-t-2xl
          h-[65vh]
          flex flex-col
          border-t
        "
        style={{
          backgroundColor:
            "var(--card-bg)",

          color:
            "var(--foreground)",

          borderColor:
            "var(--nav-border)",
        }}
      >
        {/* SCROLL */}

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* ADDRESS */}

          <div
  className="
    border rounded-xl p-3 cursor-pointer mb-4
  "
  style={{
    borderColor: "#f97316", // ORANGE BORDER
    borderWidth: "1.5px",
  }}

            onClick={() =>
              router.push(
                "/customer/address"
              )
            }
          >
            {shipping ? (
              <>
                <p className="font-medium">
                  {shipping.name}
                </p>

                <p
                  className="text-sm"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  {shipping.phone}
                </p>

                <p
                  className="text-sm mt-1"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  {
                    shipping.address_line
                  }
                </p>

                <p
                  className="text-sm mt-1"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  {[
                    shipping.ward,
                    shipping.district,
                    shipping.region,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  {" – "}
                  {getCountryDisplay(
                    shipping.country
                  )}
                  {" – "}
                  {shipping.postal_code ??
                    ""}
                </p>
              </>
            ) : (
              <p
                style={{
                  color:
                    "var(--text-muted)",
                }}
              >
                ➕{" "}
                {t.add_shipping}
              </p>
            )}
          </div>

          {/* SHIPPING REGION */}

         <div
  className="
    border rounded-xl p-3 mb-4
  "
  style={{
    borderColor: "#f97316",
    borderWidth: "1.5px",
  }}
>
            <p className="text-sm font-medium mb-3">
              🌍{" "}
              {t.select_region ||
                "Select region"}
            </p>

            {availableRegions.length ===
            0 ? (
              <p
                className="text-sm"
                style={{
                  color:
                    "var(--text-muted)",
                }}
              >
                No shipping regions
              </p>
            ) : (
              <div className="flex gap-2 overflow-x-auto">
                {availableRegions.map(
                  (r) => {
                    const active =
                      zone ===
                      r.zone;

                    return (
                      <button
                        key={`${r.zone}-${r.domestic_country_code}`}
                        onClick={() => {
                          if (
                            !r.zone
                          ) {
                            return;
                          }

                          setZone(
                            r.zone as Region
                          );
                        }}
                        className="
                          min-w-[100px]
                          rounded-xl
                          border
                          px-3 py-2
                          text-xs
                          text-center
                          transition
                        "
                        style={{
  backgroundColor: active
    ? "rgba(249, 115, 22, 0.12)"
    : "var(--card-bg)",

  color: active
    ? "#f97316"
    : "var(--foreground)",

  borderColor: active
    ? "#f97316"
    : "#e5e7eb",

  borderWidth: "1.5px",
}}
                      >
                        <div className="font-medium">
                          {r.zone ===
                          "domestic"
                            ? `Domestic (${r.domestic_country_code ?? "—"})`
                            : labelMap[
                                r.zone
                              ] ??
                              r.zone}
                        </div>

                        <div
                          className="text-[11px] mt-1"
                          style={{
                            opacity: 0.8,
                          }}
                        >
                          {formatPi(
                            r.price
                          )}{" "}
                          π
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* PRODUCT */}

          <div className="flex items-center gap-3">
            <img
              src={
                item.thumbnail ||
                "/placeholder.png"
              }
              className="
                w-16 h-16
                rounded-lg
                object-cover
                border
              "
              style={{
                borderColor:
                  "var(--nav-border)",
              }}
            />

            <div className="flex-1">
              <p className="font-medium">
                {item.name}
              </p>

              {/* QUANTITY */}

              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => {
                    const val =
                      Math.max(
                        1,
                        quantity - 1
                      );

                    setQtyDraft(
                      String(val)
                    );
                  }}
                  disabled={
                    quantity <= 1
                  }
                  className="
                    w-8 h-8
                    border rounded-lg
                    text-lg
                    disabled:opacity-30
                  "
                  style={{
                    borderColor:
                      "var(--nav-border)",
                  }}
                >
                  -
                </button>

                <input
                  type="text"
                  inputMode="numeric"
                  value={qtyDraft}
                  onChange={(e) => {
                    const val =
                      e.target.value.replace(
                        /\D/g,
                        ""
                      );

                    if (
                      val === ""
                    ) {
                      setQtyDraft(
                        ""
                      );

                      return;
                    }

                    const num =
                      Number(val);

                    if (
                      num >
                      maxStock
                    ) {
                      return;
                    }

                    setQtyDraft(
                      val
                    );
                  }}
                  onBlur={() => {
                    const val =
                      Number(
                        qtyDraft ||
                          "0"
                      );

                    if (
                      val < 1
                    ) {
                      setQtyDraft(
                        "1"
                      );
                    } else if (
                      val >
                      maxStock
                    ) {
                      setQtyDraft(
                        String(
                          maxStock
                        )
                      );
                    }
                  }}
                  className="
                    w-12
                    text-center
                    border
                    rounded-lg
                    py-1
                    text-sm
                    bg-transparent
                  "
                  style={{
                    borderColor:
                      "var(--nav-border)",
                  }}
                />

                <button
                  onClick={() => {
                    const val =
                      Math.min(
                        maxStock,
                        quantity + 1
                      );

                    setQtyDraft(
                      String(val)
                    );
                  }}
                  disabled={
                    quantity >=
                    maxStock
                  }
                  className="
                    w-8 h-8
                    border rounded-lg
                    text-lg
                    disabled:opacity-30
                  "
                  style={{
                    borderColor:
                      "var(--nav-border)",
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {/* TOTAL */}

            <div className="text-right">
              <p
  className="font-bold text-lg"
  style={{
    color: "#ef4444", // RED
  }}
>
  {formatPi(total)} π
</p>

              {(isLoading ||
                isValidating) && (
                <p
                  className="text-xs"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  Đang cập nhật
                  giá...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}

        <div
          className="border-t p-4"
          style={{
            borderColor:
              "var(--nav-border)",
          }}
        >
          <button
  onClick={handlePay}
  disabled={processing}
  className="
    w-full py-3
    rounded-xl
    font-semibold
    transition-all
    border-2
  "
  style={{
    backgroundColor: processing
      ? "#9CA3AF"
      : "#f97316", // orange primary

    borderColor: processing
      ? "#9CA3AF"
      : "#f97316",

    color: "#fff",

    boxShadow: processing
      ? "none"
      : "0 10px 25px rgba(249,115,22,0.35)",
  }}
>
  {processing ? t.processing : t.pay_now}
</button>
        </div>
      </div>
    </div>
  );
}
