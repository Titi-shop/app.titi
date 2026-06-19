"use client";

import { FormEvent, useState } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";

import { useProductForm } from "./product/useProductForm";
import ShippingRates from "./product/ShippingRates";
import VariantEditor from "./product/VariantEditor";
import {
  inputClass,
  inputStyle,
  cardStyle,
} from "./product/product-form.styles";

import {
  ProductFormErrors,
} from "./product/product-form.types";

import {
  uploadProductImages,
  uploadDetailImages,
} from "./product/product-upload";

import {
  showMessage,
} from "./product/product-notify";

import {
  validateProductSale,
  validateVariantSale,
} from "./product/product-form.validation";

import {
  buildProductPayload,
  normalizeVariants,
} from "./product/product-form.payload";
import type {
  Category,
  ProductPayload,
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
  const [errors, setErrors] =
  useState<ProductFormErrors>(
    {}
  );

  const inputClass =
  "w-full border p-2 rounded transition-colors";

const inputStyle = {
  background: "var(--card-bg)",
  color: "var(--foreground)",
  borderColor: "var(--nav-border)",
};

const cardStyle = {
  background: "var(--card-bg)",
  color: "var(--foreground)",
  borderColor: "var(--nav-border)",
};
  /* =========================
     HELPERS
  ========================= */

  const toNumber = (value: string): number => {
    if (value.trim() === "") return 0;

    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
  };

  /* =========================
     MAIN IMAGE UPLOAD
  ========================= */

  const handleUpload = async (
  files: File[]
) => {
  try {
    setUploading(true);

    const urls =
      await uploadProductImages(
        files
      );

    form.setImages(
      (prev) => [
        ...prev,
        ...urls,
      ]
    );
  } catch (error) {
    console.error(error);

    showMessage(
      t.upload_failed
    );
  } finally {
    setUploading(false);
  }
};

  /* =========================
     DETAIL IMAGE UPLOAD
  ========================= */

  const handleDetailUpload =
  async (
    files: File[]
  ) => {
    if (!user) return;

    try {
      const urls =
        await uploadDetailImages(
          files,
          user.id
        );

      form.setDetail(
        (prev) =>
          `${prev}\n${urls
            .map(
              (url) =>
                `<img src="${url}" />`
            )
            .join("\n")}`
      );
    } catch (error) {
      console.error(error);

      showMessage(
        t.upload_failed
      );
    }
  };

  /* =========================
     LOADING
  ========================= */

  if (loading || !user) {
    return (
      <div
  className="p-8 text-center"
  style={{
    color: "var(--foreground)",
  }}
>
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
  setErrors({
    name: true,
  });
  setSubmitting(false);
  return;
}
if (
  !form.category_id ||
  Number(form.category_id) <= 0
) {
  setErrors({
    category: true,
  });
  setSubmitting(false);
  return;
}
      if (!form.images.length) {
  setErrors({
    images: true,
  });
  setSubmitting(false);
  return;
      }

      /* =========================
         PRODUCT PRICE
      ========================= */

      if (
  hasVariants &&
  form.sale_enabled
) {
  form.setSale_enabled(false);
      }

    const productSaleError =
  validateProductSale(
    Boolean(
      form.sale_enabled
    ),
    Number(form.price),
    Number(
      form.sale_price
    ),
    Number(
      form.sale_stock
    ),
    form.sale_start,
    form.sale_end
  );

if (productSaleError) {
  showMessage(
    t[
      productSaleError.toLowerCase() as keyof typeof t
    ] ??
      productSaleError
  );

  setSubmitting(false);

  return;
}

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
  required
  value={form.category_id ?? ""}
  onChange={(e) => {
    setErrors((prev) => ({
      ...prev,
      category: false,
    }));

    form.setCategory_id(
      e.target.value
        ? Number(e.target.value)
        : ""
    );
  }}
 className={`w-full border p-2 rounded ${
  errors.category ? "border-red-500" : ""
}`}
style={{
  ...inputStyle,
}}
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
  required
  value={form.name}
  onChange={(e) => {
    setErrors((prev) => ({
      ...prev,
      name: false,
    }));

    form.setName(
      e.target.value
    );
  }}
  placeholder={t.product_name}
  className={`w-full border p-2 rounded ${
  errors.name ? "border-red-500" : ""
}`}
style={{
  ...inputStyle,
}}
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
style={{
  borderColor: "var(--nav-border)",
}}
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
               className="absolute top-1 right-1 px-2 rounded text-xs opacity-0 group-hover:opacity-100"
style={{
  background: "rgba(0,0,0,.65)",
  color: "#fff",
}}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <label
  className="flex flex-col items-center justify-center border-2 border-dashed h-28 rounded-xl cursor-pointer transition-colors"
  style={{
    background: "var(--card-bg)",
    borderColor: errors.images
      ? "#ef4444"
      : "var(--nav-border)",
    color: "var(--foreground)",
  }}
>
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
  required
  type="number"
  step="0.00001"
  min="0.00001"
  inputMode="decimal"
  value={form.price}
  onChange={(e) => {
    setErrors((prev) => ({
      ...prev,
      price: false,
    }));

    form.setPrice(
      e.target.value
        ? Number(e.target.value)
        : ""
    );
  }}
  placeholder={t.price}
  className={`w-full border p-2 rounded ${
    errors.price
      ? "border-red-500"
      : ""
  }`}
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
           className={inputClass}
            style={inputStyle}
          />

          {/* SALE ENABLE */}
          <label
  className="flex justify-between border p-2 rounded"
  style={cardStyle}
>
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
    setErrors((prev) => ({
      ...prev,
      sale_price: false,
    }));

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
  className={`w-full border p-2 rounded ${
    errors.sale_price
      ? "border-red-500"
      : ""
  }`}
/>
          )}

          {/* SALE STOCK */}
      {form.sale_enabled && (
        <input
          type="number"
          value={form.sale_stock || 0}
          onChange={(e) => {
            setErrors((prev) => ({
              ...prev,
              sale_stock: false,
            }));

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
          className={`w-full border p-2 rounded ${
            errors.sale_stock
              ? "border-red-500"
              : ""
          }`}
        />
      )}
</>
)}
      {/* SALE TIME */}
<div className="grid grid-cols-2 gap-2">
  <input
    type="datetime-local"
    value={form.sale_start || ""}
    onChange={(e) => {
      setErrors((prev) => ({
        ...prev,
        sale_start: false,
      }));

      form.setSale_start(e.target.value);
    }}
    className={`border p-2 rounded ${
      errors.sale_start ? "border-red-500" : ""
    }`}
    style={{
      ...inputStyle,
      colorScheme: document?.documentElement?.classList.contains(
        "theme-dark"
      )
        ? "dark"
        : "light",
    }}
  />

  <input
    type="datetime-local"
    value={form.sale_end || ""}
    onChange={(e) => {
      setErrors((prev) => ({
        ...prev,
        sale_end: false,
      }));

      form.setSale_end(e.target.value);
    }}
    className={`border p-2 rounded ${
      errors.sale_end ? "border-red-500" : ""
    }`}
    style={{
      ...inputStyle,
      colorScheme: document?.documentElement?.classList.contains(
        "theme-dark"
      )
        ? "dark"
        : "light",
    }}
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
      <label
  className="flex justify-between border p-3 rounded"
  style={cardStyle}
>
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
style={inputStyle}
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
style={inputStyle}
      />

      {/* DETAIL IMAGE */}
      <label
  className="border-2 border-dashed h-20 flex items-center justify-center rounded cursor-pointer"
  style={{
    background: "var(--card-bg)",
    borderColor: "var(--nav-border)",
    color: "var(--foreground)",
  }}
>
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
  className="w-full py-3 rounded transition-all duration-200 active:scale-95"
  style={{
    background: submitting
      ? "var(--text-muted)"
      : "var(--color-primary)",
    color:
      document?.documentElement?.classList.contains(
        "theme-dark"
      )
        ? "#000"
        : "#fff",
    opacity: submitting ? 0.7 : 1,
  }}
>
        {submitting
          ? t.submitting
          : t.submit_product}
      </button>
    </form>
  );
}
