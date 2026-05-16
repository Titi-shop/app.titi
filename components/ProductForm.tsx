"use client";

import { FormEvent, useState } from "react";
import { toUTCFromInput } from "@/lib/utils/time";
import { compressImage } from "@/lib/upload/imageUtils";
import { getPiAccessToken } from "@/lib/piAuth";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase/client";

import { useProductForm } from "./product/useProductForm";
import ShippingRates from "./product/ShippingRates";
import VariantEditor from "./product/VariantEditor";

import type { ProductVariant } from "./product/types";

/* =========================
   TYPES
========================= */

interface Category {
  id: string;
  key: string;
}

interface ProductFormProps {
  categories: Category[];
  initialData?: Record<string, unknown>;
  onSubmit: (payload: ProductPayload) => Promise<void>;
}

interface ShippingRatePayload {
  zone: string;
  price: number;
}

interface ProductPayload {
  id?: string;
  name: string;
  categoryId: string | null;
  description: string;
  detail: string;
  images: string[];
  thumbnail: string;
  isActive: boolean;

  shippingRates: ShippingRatePayload[];
  domesticCountryCode: string | null;

  price?: number;
  stock?: number;

  salePrice: number | null;
  saleEnabled?: boolean;
  saleStock: number;

  saleStart: string | null;
  saleEnd: string | null;

  variants: ProductVariant[];

  idempotencyKey: string;
}

interface SignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
}

/* =========================
   COMPONENT
========================= */

export default function ProductForm({
  categories,
  initialData,
  onSubmit,
}: ProductFormProps) {
  const { t } = useTranslation();

  const { user, loading } = useAuth();
  const form = useProductForm(initialData);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* =========================
     HELPERS
  ========================= */

  const generateKey = (): string =>
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const toNumber = (value: string): number => {
    if (value.trim() === "") return 0;

    const n = Number(value);

    return Number.isNaN(n) ? 0 : n;
  };

  /* =========================
     UPLOAD
  ========================= */

  const uploadWithProgress = (
    url: string,
    file: File,
    index: number
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("PUT", url);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);

          console.log(`📊 [${index}] ${percent}%`);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve();
        } else {
          reject(new Error(String(xhr.status)));
        }
      };

      xhr.onerror = () => {
        reject(new Error("NETWORK_ERROR"));
      };

      xhr.setRequestHeader("Content-Type", file.type);

      xhr.send(file);
    });

  const getSignedUrl = async (): Promise<SignedUrlResponse> => {
    const token = await getPiAccessToken();

    const res = await fetch("/api/upload-url", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();

      console.error("❌ SIGNED URL FAIL:", text);

      throw new Error("SIGNED_URL_FAILED");
    }

    const data: SignedUrlResponse = await res.json();

    if (!data.uploadUrl || !data.publicUrl) {
      throw new Error("NO_UPLOAD_URL");
    }

    return data;
  };

  /* =========================
     MAIN IMAGE UPLOAD
  ========================= */

  const handleUpload = async (files: File[]) => {
    if (!files.length) return;

    try {
      setUploading(true);

      const uploads = files.map(async (file, index) => {
        const compressed = await compressImage(file);

        const { uploadUrl, publicUrl } = await getSignedUrl();

        await uploadWithProgress(uploadUrl, compressed, index);

        return publicUrl;
      });

      const urls = await Promise.all(uploads);

      form.setImages((prev: string[]) => [...prev, ...urls]);

    } catch (error) {
      console.error("💥 UPLOAD ERROR:", error);

      alert(t.upload_failed);

    } finally {
      setUploading(false);
    }
  };

  /* =========================
     DETAIL IMAGE UPLOAD
  ========================= */

  const uploadDetailImages = async (files: File[]) => {
    if (!files.length || !user) return;

    try {
      const uploads = files.map(async (file) => {
        const path = `products/${user.id}/detail-${Date.now()}.jpg`;

        const { error } = await supabase.storage
          .from("products")
          .upload(path, file);

        if (error) {
          throw error;
        }

        const { data } = supabase.storage
          .from("products")
          .getPublicUrl(path);

        return data.publicUrl;
      });

      const urls = await Promise.all(uploads);

      form.setDetail((prev: string) => {
        const html = urls
          .map((url) => `<img src="${url}" />`)
          .join("\n");

        return `${prev}\n${html}`;
      });

    } catch (error) {
      console.error("💥 DETAIL IMAGE ERROR:", error);

      alert(t.upload_failed);
    }
  };

  /* =========================
     LOADING
  ========================= */

  if (loading || !user) {
    return (
      <div className="p-8 text-center">
        {t.loading}
      </div>
    );
  }

  /* =========================
     SUBMIT
  ========================= */

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (submitting) return;

    setSubmitting(true);

    try {
      const hasVariants = form.variants.length > 0;

      const hasSaleTime =
        Boolean(form.saleStart) &&
        Boolean(form.saleEnd);

      const hasSalePrice =
        form.salePrice !== "" &&
        form.salePrice !== null &&
        form.salePrice !== undefined &&
        !Number.isNaN(Number(form.salePrice));

      /* =========================
         VALIDATION
      ========================= */

      if (!form.name.trim()) {
        alert(t.invalid_product_name);
        setSubmitting(false);
        return;
      }

      if (!form.images.length) {
        alert(t.product_need_image);
        setSubmitting(false);
        return;
      }

      /* =========================
         PRODUCT PRICE
      ========================= */

      if (
        !hasVariants &&
        Number(form.price) < 0.00001
      ) {
        alert(t.price_minimum_error);
        setSubmitting(false);
        return;
      }

      /* =========================
         SALE VALIDATION
      ========================= */

      if (!hasVariants && form.saleEnabled) {
        const sale = Number(form.salePrice);
        const price = Number(form.price);

        if (!hasSaleTime) {
          alert(t.sale_time_required);
          setSubmitting(false);
          return;
        }

        if (
          Number.isNaN(sale) ||
          sale < 0.00001
        ) {
          alert(t.sale_price_minimum_error);
          setSubmitting(false);
          return;
        }

        if (sale >= price) {
          alert(t.sale_price_less_than_price);
          setSubmitting(false);
          return;
        }
      }

      /* =========================
         SALE TIME BUT NO PRICE
      ========================= */

      if (
        !hasVariants &&
        hasSaleTime &&
        !hasSalePrice
      ) {
        alert(t.sale_price_required);
        setSubmitting(false);
        return;
      }

      /* =========================
         SHIPPING
      ========================= */

      const shippingRatesPayload: ShippingRatePayload[] =
        Object.entries(form.shippingRates).map(
          ([zone, price]) => ({
            zone,
            price: Number(price || 0),
          })
        );

      /* =========================
         VARIANTS
      ========================= */

      const normalizedVariants: ProductVariant[] =
        form.variants.map((v) => ({
          ...v,

          saleEnabled: Boolean(v.saleEnabled),

          salePrice:
            v.saleEnabled &&
            v.salePrice !== null
              ? Number(v.salePrice)
              : null,

          saleStock:
            v.saleEnabled
              ? Number(v.saleStock || 0)
              : 0,

          saleSold: Number(v.saleSold || 0),

          finalPrice:
            v.saleEnabled &&
            v.salePrice !== null &&
            Number(v.salePrice) > 0 &&
            Number(v.salePrice) < Number(v.price)
              ? Number(v.salePrice)
              : Number(v.price),
        }));

      /* =========================
         PAYLOAD
      ========================= */
      const hasVariantSale = normalizedVariants.some(
  (v) =>
    Boolean(v.saleEnabled) &&
    Number(v.salePrice) > 0
);

console.log("🧪 FORM CATEGORY:", form.categoryId);

const payload: ProductPayload = {
  id:
    typeof form.id === "string"
      ? form.id
      : undefined,

  name: form.name,

  categoryId:
    typeof form.categoryId === "string" &&
    form.categoryId.trim().length > 0
      ? form.categoryId.trim()
      : undefined,

  description: form.description,

  detail: form.detail,

  images: form.images,

  thumbnail: form.images[0] || null,

  isActive: form.isActive,

  shippingRates: shippingRatesPayload,

  domesticCountryCode:
    form.primaryShippingCountry || null,

  /* =====================================================
     PRODUCT PRICE / STOCK
  ===================================================== */

  price: hasVariants
    ? undefined
    : Number(form.price),

  stock: hasVariants
    ? undefined
    : Number(form.stock || 0),

  saleEnabled:
    hasVariants
      ? hasVariantSale
      : form.saleEnabled &&
        hasSaleTime &&
        hasSalePrice,

  salePrice:
    hasVariants
      ? null
      : !form.saleEnabled
        ? null
        : Number(form.salePrice),

  saleStock:
    hasVariants || !form.saleEnabled
      ? 0
      : Number(form.saleStock || 0),

  saleStart:
    hasSaleTime
      ? toUTCFromInput(form.saleStart)
      : null,

  saleEnd:
    hasSaleTime
      ? toUTCFromInput(form.saleEnd)
      : null,

  variants: normalizedVariants,

  idempotencyKey: generateKey(),
};

console.log("🧪 PAYLOAD CATEGORY:", payload.categoryId);

console.log("📦 PRODUCT PAYLOAD:", payload);

await onSubmit(payload);
    } catch (error) {
      console.error(error);
      alert(t.submit_failed);
    } finally {
      setSubmitting(false);
    }

  };
  /* =========================
     UI
  ========================= */

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {/* CATEGORY */}
<select
  value={form.categoryId}
  onChange={(e) =>
    form.setCategoryId(e.target.value)
  }
  className="w-full border p-2 rounded"
>
  <option value="">
    {t.select_category}
  </option>

  {categories.map((category) => (
    <option
      key={category.id}
      value={category.id}
    >
      {t[
        category.key as keyof typeof t
      ] || category.key}
    </option>
  ))}
</select>

      {/* NAME */}
      <input
        value={form.name}
        onChange={(e) =>
          form.setName(e.target.value)
        }
        placeholder={t.product_name}
        className="w-full border p-2 rounded"
      />

      {/* IMAGES */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {form.images.map((img: string, i: number) => (
            <div
              key={`${img}-${i}`}
              className="relative group"
            >
              <img
                src={img}
                alt=""
                className="h-24 w-full object-cover rounded-lg border"
              />

              <button
                type="button"
                onClick={() =>
                  form.setImages((prev: string[]) =>
                    prev.filter(
                      (_, idx) => idx !== i
                    )
                  )
                }
                className="absolute top-1 right-1 bg-black/60 text-white px-2 rounded text-xs opacity-0 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <label className="flex flex-col items-center justify-center border-2 border-dashed h-28 rounded-xl cursor-pointer hover:bg-gray-50">
          {uploading
            ? t.uploading
            : t.upload_image}

          <input
            type="file"
            hidden
            multiple
            accept="image/*"
            onChange={(e) =>
              handleUpload(
                Array.from(
                  e.target.files || []
                )
              )
            }
          />
        </label>
      </div>

      {/* PRICE */}
      {form.variants.length === 0 && (
        <>
          <input
            type="number"
            step="0.00001"
            min="0.00001"
            inputMode="decimal"
            value={form.price}
            onChange={(e) =>
              form.setPrice(
                e.target.value
                  ? Number(e.target.value)
                  : ""
              )
            }
            placeholder={t.price}
            className="w-full border p-2 rounded"
          />

          {/* STOCK */}
          <input
            type="number"
            value={form.stock}
            onChange={(e) =>
              form.setStock(
                toNumber(e.target.value)
              )
            }
            placeholder={t.stock}
            className="w-full border p-2 rounded"
          />

          {/* SALE ENABLE */}
          <label className="flex justify-between border p-2 rounded">
            <span>{t.enable_sale}</span>

            <input
              type="checkbox"
              checked={Boolean(form.saleEnabled)}
              onChange={(e) => {
                const checked =
                  e.target.checked;

                form.setSaleEnabled(checked);

                if (!checked) {
                  form.setSaleStart(null);
                  form.setSaleEnd(null);
                  form.setSalePrice("");
                  form.setSaleStock(0);
                }
              }}
            />
          </label>

          {/* SALE PRICE */}
          {form.saleEnabled && (
            <input
              type="number"
              step="0.00001"
              min="0.00001"
              inputMode="decimal"
              value={
                form.salePrice === ""
                  ? ""
                  : form.salePrice
              }
              onChange={(e) => {
                const value =
                  e.target.value;

                if (value === "") {
                  form.setSalePrice("");
                  return;
                }

                form.setSalePrice(
                  Number(value)
                );
              }}
              placeholder={t.sale_price}
              className="w-full border p-2 rounded"
            />
          )}

          {/* SALE STOCK */}
          {form.saleEnabled && (
            <input
              type="number"
              value={form.saleStock || 0}
              onChange={(e) => {
                const value = Number(
                  e.target.value
                );

                if (value > form.stock) {
                  alert(
                    t.sale_stock_exceed
                  );

                  return;
                }

                form.setSaleStock(value);
              }}
              placeholder={t.sale_stock}
              className="w-full border p-2 rounded"
            />
          )}
        </>
      )}

      {/* SALE TIME */}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="datetime-local"
          value={form.saleStart || ""}
          onChange={(e) =>
            form.setSaleStart(
              e.target.value
            )
          }
          className="border p-2 rounded"
        />

        <input
          type="datetime-local"
          value={form.saleEnd || ""}
          onChange={(e) =>
            form.setSaleEnd(
              e.target.value
            )
          }
          className="border p-2 rounded"
        />
      </div>

      {/* SHIPPING */}
      <ShippingRates
        shippingRates={form.shippingRates}
        setShippingRates={
          form.setShippingRates
        }
        primaryShippingCountry={
          form.primaryShippingCountry
        }
        setPrimaryShippingCountry={
          form.setPrimaryShippingCountry
        }
      />

      {/* ACTIVE */}
      <label className="flex justify-between border p-3 rounded">
        <span>{t.active}</span>

        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) =>
            form.setIsActive(
              e.target.checked
            )
          }
        />
      </label>

      {/* VARIANTS */}
      <VariantEditor
        variants={form.variants}
        setVariants={form.setVariants}
      />

      {/* DESCRIPTION */}
      <textarea
        value={form.description}
        onChange={(e) =>
          form.setDescription(
            e.target.value
          )
        }
        placeholder={t.description}
        className="w-full border p-2 rounded min-h-[80px]"
      />

      {/* DETAIL */}
      <textarea
        value={form.detail}
        onChange={(e) =>
          form.setDetail(
            e.target.value
          )
        }
        placeholder={t.product_detail}
        className="w-full border p-2 rounded min-h-[120px]"
      />

      {/* DETAIL IMAGE */}
      <label className="border-2 border-dashed h-20 flex items-center justify-center rounded cursor-pointer">
        {t.upload_detail_image}

        <input
          type="file"
          hidden
          multiple
          accept="image/*"
          onChange={(e) =>
            uploadDetailImages(
              Array.from(
                e.target.files || []
              )
            )
          }
        />
      </label>

      {/* SUBMIT */}
      <button
        type="submit"
        disabled={submitting}
        className={`w-full py-3 rounded text-white transition-all duration-200 ${
          submitting
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-orange-500 active:scale-95"
        }`}
      >
        {submitting
          ? t.submitting
          : t.submit_product}
      </button>
    </form>
  );
}
