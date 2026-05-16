"use client";

import { FormEvent, useState, useMemo } from "react";
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

/* =========================================================
   TYPES
========================================================= */

interface Category {
  id: string;
  key: string;
}

interface ProductFormProps {
  categories: Category[];
  initialData?: Record<string, unknown>;
  onSubmit: (payload: any) => Promise<void>;
}

interface ShippingRatePayload {
  zone: string;
  price: number;
  domestic_country_code?: string | null;
}

interface SignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
}

/* =========================================================
   NORMALIZE DB -> FORM
========================================================= */

function normalizeInitialData(initialData?: Record<string, unknown>) {
  if (!initialData) return undefined;

  const d: any = initialData;

  return {
    id: d.id,
    name: d.name,
    categoryId: d.category_id ?? d.categoryId,

    description: d.description,
    detail: d.detail,

    images: d.images || [],

    price: d.price,
    stock: d.stock,

    salePrice: d.sale_price,
    saleEnabled: d.sale_enabled,
    saleStock: d.sale_stock,
    saleStart: d.sale_start,
    saleEnd: d.sale_end,

    isActive: d.is_active,

    variants: d.variants || [],
    shippingRates: d.shippingRates || [],
  };
}

/* =========================================================
   COMPONENT
========================================================= */

export default function ProductForm({
  categories,
  initialData,
  onSubmit,
}: ProductFormProps) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  const normalized = useMemo(
    () => normalizeInitialData(initialData),
    [initialData]
  );

  const form = useProductForm(normalized);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* ================= HELPERS ================= */

  const generateKey = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const toNumber = (v: string) => {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  };

  const toInputDateTime = (v: any) => {
    if (!v) return "";
    return new Date(v).toISOString().slice(0, 16);
  };

  /* ================= UPLOAD ================= */

  const uploadWithProgress = (url: string, file: File, index: number) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", file.type);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const p = Math.round((e.loaded / e.total) * 100);
          console.log(`📊 [${index}] ${p}%`);
        }
      };

      xhr.onload = () =>
        xhr.status === 200 ? resolve() : reject(new Error("UPLOAD_FAIL"));

      xhr.onerror = () => reject(new Error("NETWORK_ERROR"));

      xhr.send(file);
    });

  const getSignedUrl = async (): Promise<SignedUrlResponse> => {
    const token = await getPiAccessToken();

    const res = await fetch("/api/upload-url", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("SIGNED_URL_FAILED");

    return res.json();
  };

  const handleUpload = async (files: File[]) => {
    if (!files.length) return;

    try {
      setUploading(true);

      const urls = await Promise.all(
        files.map(async (file, i) => {
          const compressed = await compressImage(file);
          const { uploadUrl, publicUrl } = await getSignedUrl();

          await uploadWithProgress(uploadUrl, compressed, i);
          return publicUrl;
        })
      );

      form.setImages((prev: string[]) => [...prev, ...urls]);
    } finally {
      setUploading(false);
    }
  };

  const uploadDetailImages = async (files: File[]) => {
    if (!files.length || !user) return;

    const urls = await Promise.all(
      files.map(async (file) => {
        const path = `products/${user.id}/detail-${Date.now()}.jpg`;

        const { error } = await supabase.storage
          .from("products")
          .upload(path, file);

        if (error) throw error;

        const { data } = supabase.storage
          .from("products")
          .getPublicUrl(path);

        return data.publicUrl;
      })
    );

    form.setDetail((prev: string) =>
      prev + urls.map((u) => `<img src="${u}" />`).join("\n")
    );
  };

  /* ================= SUBMIT ================= */

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);

    try {
      const hasVariants = form.variants.length > 0;

      const hasSaleTime =
        Boolean(form.saleStart) && Boolean(form.saleEnd);

      const hasSalePrice =
        form.salePrice !== "" &&
        form.salePrice !== null &&
        !Number.isNaN(Number(form.salePrice));

      if (!form.name.trim()) {
        alert(t.invalid_product_name);
        return;
      }

      if (!form.images.length) {
        alert(t.product_need_image);
        return;
      }

      const shippingRatesPayload: ShippingRatePayload[] =
        Object.entries(form.shippingRates).map(([zone, price]) => ({
          zone,
          price: Number(price || 0),
          domestic_country_code:
            zone === "domestic"
              ? form.primaryShippingCountry || null
              : null,
        }));

      const normalizedVariants: ProductVariant[] =
        form.variants.map((v) => ({
          ...v,
          saleEnabled: Boolean(v.saleEnabled),
          salePrice:
            v.saleEnabled && v.salePrice !== null
              ? Number(v.salePrice)
              : null,
        }));

      const payload = {
        id: typeof form.id === "string" ? form.id : undefined,
        name: form.name,
        categoryId: form.categoryId || undefined,

        description: form.description,
        detail: form.detail,

        images: form.images,
        thumbnail: form.images[0] || null,

        isActive: form.isActive,

        shippingRates: shippingRatesPayload,

        price: hasVariants ? undefined : Number(form.price),
        stock: hasVariants ? undefined : Number(form.stock || 0),

        saleEnabled: form.saleEnabled,
        salePrice:
          form.saleEnabled ? Number(form.salePrice) : null,
        saleStock: form.saleEnabled ? Number(form.saleStock) : 0,

        saleStart: hasSaleTime
          ? toUTCFromInput(form.saleStart)
          : null,
        saleEnd: hasSaleTime ? toUTCFromInput(form.saleEnd) : null,

        variants: normalizedVariants,

        idempotencyKey: generateKey(),
      };

      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  /* ================= UI ================= */

  if (loading || !user) {
    return <div className="p-8 text-center">{t.loading}</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* CATEGORY */}
      <select
        value={form.categoryId}
        onChange={(e) => form.setCategoryId(e.target.value)}
        className="w-full border p-2 rounded"
      >
        <option value="">{t.select_category}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {t[c.key as keyof typeof t] || c.key}
          </option>
        ))}
      </select>

      {/* NAME */}
      <input
        value={form.name}
        onChange={(e) => form.setName(e.target.value)}
        className="w-full border p-2 rounded"
        placeholder={t.product_name}
      />

      {/* ACTIVE (FIXED: is_active sync OK) */}
      <label className="flex justify-between border p-3 rounded">
        <span>{t.active}</span>
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => form.setIsActive(e.target.checked)}
        />
      </label>

      {/* PRICE */}
      {form.variants.length === 0 && (
        <>
          <input
            type="number"
            value={form.price}
            onChange={(e) =>
              form.setPrice(e.target.value ? Number(e.target.value) : "")
            }
            className="w-full border p-2 rounded"
            placeholder={t.price}
          />

          <input
            type="number"
            value={form.stock}
            onChange={(e) => form.setStock(toNumber(e.target.value))}
            className="w-full border p-2 rounded"
            placeholder={t.stock}
          />

          {/* SALE */}
          <label className="flex justify-between border p-2 rounded">
            <span>{t.enable_sale}</span>
            <input
              type="checkbox"
              checked={form.saleEnabled}
              onChange={(e) => form.setSaleEnabled(e.target.checked)}
            />
          </label>

          {form.saleEnabled && (
            <input
              type="number"
              value={form.salePrice}
              onChange={(e) =>
                form.setSalePrice(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              className="w-full border p-2 rounded"
              placeholder={t.sale_price}
            />
          )}
        </>
      )}

      {/* SALE TIME (FIXED DISPLAY) */}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="datetime-local"
          value={form.saleStart}
          onChange={(e) => form.setSaleStart(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="datetime-local"
          value={form.saleEnd}
          onChange={(e) => form.setSaleEnd(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {/* SHIPPING */}
      <ShippingRates
        shippingRates={form.shippingRates}
        setShippingRates={form.setShippingRates}
        primaryShippingCountry={form.primaryShippingCountry}
        setPrimaryShippingCountry={form.setPrimaryShippingCountry}
      />

      {/* VARIANTS */}
      <VariantEditor
        variants={form.variants}
        setVariants={form.setVariants}
      />

      {/* DESCRIPTION */}
      <textarea
        value={form.description}
        onChange={(e) => form.setDescription(e.target.value)}
        className="w-full border p-2 rounded"
      />

      {/* DETAIL */}
      <textarea
        value={form.detail}
        onChange={(e) => form.setDetail(e.target.value)}
        className="w-full border p-2 rounded"
      />

      {/* SUBMIT */}
      <button
        disabled={submitting}
        className="w-full py-3 bg-orange-500 text-white rounded"
      >
        {submitting ? t.submitting : t.submit_product}
      </button>
    </form>
  );
}
