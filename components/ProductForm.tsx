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

import type {
  Category,
  ProductPayload,
  ProductVariant,
  ShippingRate,
} from "@/types/product";
/* =========================
   TYPES
========================= */
interface ProductFormProps {
  categories: Category[];

  initialData?: Partial<ProductPayload>;

  onSubmit: (
    payload: ProductPayload
  ) => Promise<void>;
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
        Boolean(form.sale_start) &&
        Boolean(form.sale_end);

      const hasSalePrice =
        form.sale_price !== "" &&
        form.sale_price !== null &&
        form.sale_price !== undefined &&
        !Number.isNaN(Number(form.sale_price));

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

      if (!hasVariants && form.sale_enabled) {
        const sale = Number(form.sale_price);
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

      const shippingRatesPayload: ShippingRate[] =
  Object.entries(form.shipping_rates).map(
    ([zone, price]) => ({
      zone: zone as ShippingRate["zone"],
      price: Number(price || 0),
    })
  );

      /* =========================
         VARIANTS
      ========================= */

      const normalizedVariants: ProductVariant[] =
        form.variants.map((v) => ({
          ...v,

          sale_enabled: Boolean(v.sale_enabled),

          sale_price:
            v.sale_enabled &&
            v.sale_price !== null
              ? Number(v.sale_price)
              : null,

          sale_stock:
            v.sale_enabled
              ? Number(v.sale_stock || 0)
              : 0,

          sale_sold: Number(v.sale_sold || 0),
      final_price:
     v.sale_enabled &&
       v.sale_price !== null &&
            Number(v.sale_price) > 0 &&
            Number(v.sale_price) < Number(v.price)
              ? Number(v.sale_price)
              : Number(v.price),
        }));

      /* =========================
         PAYLOAD
      ========================= */
      const hasVariantSale = normalizedVariants.some(
  (v) =>
    Boolean(v.sale_enabled) &&
    Number(v.sale_price) > 0
);

console.log("🧪 FORM CATEGORY:", form.category_id);
const payload: ProductPayload = {
  id:
    typeof form.id === "string"
      ? form.id
      : undefined,
  name: form.name,
  category_id:
  form.category_id !== "" &&
  form.category_id !== null &&
  form.category_id !== undefined
    ? Number(form.category_id)
    : undefined,

  description: form.description,
  detail: form.detail,
  images: form.images,
  thumbnail: form.images[0] || null,
  is_active: form.is_active,

shipping_rates: shippingRatesPayload,
  domestic_country_code:
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

  sale_enabled:
    hasVariants
      ? hasVariantSale
      :form.sale_enabled &&
        hasSaleTime &&
        hasSalePrice,

  sale_price:
    hasVariants
      ? null
      : !form.sale_enabled
        ? null
        : Number(form.sale_price),

  sale_stock:
    hasVariants || !form.sale_enabled
      ? 0
      : Number(form.sale_stock || 0),

  sale_start:
    hasSaleTime
      ? toUTCFromInput(form.sale_start)
      : null,

  sale_end:
    hasSaleTime
      ? toUTCFromInput(form.sale_end)
      : null,

  variants: normalizedVariants,
  idempotency_key: generateKey(),
};

console.log("🧪 FORM CATEGORY:", form.category_id);
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
  value={form.category_id ?? ""}
  onChange={(e) =>
  form.setCategoryId(
    e.target.value
      ? Number(e.target.value)
      : ""
  )
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
              checked={Boolean(form.sale_enabled)}
              onChange={(e) => {
                const checked =
                  e.target.checked;

                form.setSale_enabled(checked);
                if (!checked) {
                  form.setSale_start("");
                    form.setSale_end("");
                  form.setSale_price("");
                  form.setSale_stock(0);
                }
              }}
            />
          </label>

          {/* SALE PRICE */}
          {form.sale_enabled && (
            <input
              type="number"
              step="0.00001"
              min="0.00001"
              inputMode="decimal"
              value={
                form.sale_price === ""
                  ? ""
                  : form.sale_price
              }
              onChange={(e) => {
                const value =
                  e.target.value;

                if (value === "") {
                  form.setSale_price("");
                  return;
                }

                form.setSale_price(
                  Number(value)
                );
              }}
              placeholder={t.sale_price}
              className="w-full border p-2 rounded"
            />
          )}

          {/* SALE STOCK */}
          {form.sale_enabled && (
            <input
              type="number"
              value={form.sale_stock || 0}
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

                form.setSale_stock(value);
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
          value={form.sale_start || ""}
          onChange={(e) =>
            form.setSaleStart(
              e.target.value
            )
          }
          className="border p-2 rounded"
        />

        <input
          type="datetime-local"
          value={form.sale_end || ""}
          onChange={(e) =>
            form.setSale_end(
              e.target.value
            )
          }
          className="border p-2 rounded"
        />
      </div>

      {/* SHIPPING */}
      <ShippingRates
  shipping_rates={form.shipping_rates}
  setShipping_rates={form.setShipping_rates}
  domestic_country_code={
    form.domestic_country_code
  }
  setDomestic_country_code={
    form.setDomestic_country_code
  }
/>
      {/* ACTIVE */}
      <label className="flex justify-between border p-3 rounded">
        <span>{t.active}</span>

        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) =>
            form.setIs_active(
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
