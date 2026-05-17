"use client";

import useSWR from "swr";

import {
  useParams,
  useRouter,
} from "next/navigation";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import ProductForm from "@/components/ProductForm";
import type {
  ProductRecord,
  ProductPayload,
} from "@/types/Product";
/* =====================================================
   TYPES
===================================================== */

interface Category {
  id: string;
  key: string;
}

/* =====================================================
   FETCHER
===================================================== */

const fetcher = async (
  url: string
) => {
  const res = await apiAuthFetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("FETCH_FAILED");
  }

  return res.json();
};

/* =====================================================
   TIME
===================================================== */

function toDateTimeLocal(
  value?: string | null
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  const offset =
    date.getTimezoneOffset();

  const local = new Date(
    date.getTime() -
      offset * 60000
  );

  return local
    .toISOString()
    .slice(0, 16);
}

/* =====================================================
   MAP PRODUCT -> FORM PAYLOAD
===================================================== */

function mapProductToPayload(
  product: ProductRecord
): ProductPayload {
  return {
    id: product.id,

    name: product.name,
    category_id:
  product.category_id !== null
    ? String(product.category_id)
    : null,

    description:
      product.description || "",

    detail: product.detail || "",

    images:
      Array.isArray(product.images)
        ? product.images
        : [],

    thumbnail:
      product.thumbnail || null,

    is_active:
  Boolean(product.is_active),
    
    shipping_rates:
      Array.isArray(
        product.shipping_rates
      )
        ? product.shipping_rates
        : [],

    domestic_country_code:
      product
        .domestic_country_code ??
      null,

    /* =====================================================
       PRICE / STOCK
    ===================================================== */

    price: product.price,

    stock: product.stock,

    /* =====================================================
       SALE
    ===================================================== */

    sale_enabled:
  Boolean(product.sale_enabled),

    sale_price:
  product.sale_price,

    sale_stock:
  product.sale_stock || 0,

    sale_start:
  toDateTimeLocal(
    product.sale_start
  ),

    sale_end:
  toDateTimeLocal(
    product.sale_end
  ),

    /* =====================================================
       VARIANTS
    ===================================================== */

    variants:
      Array.isArray(
        product.variants
      )
        ? product.variants
        : [],
  };
}

/* =====================================================
   PAGE
===================================================== */

export default function SellerEditPage() {
  const { t } =
    useTranslation();

  const router = useRouter();

  const params = useParams();

  const { user, loading } =
    useAuth();

  const isSeller =
    user?.role === "seller";

  const id =
    typeof params.id === "string"
      ? params.id
      : "";

  /* =====================================================
     LOAD CATEGORIES
  ===================================================== */

  const {
    data: categories = [],
  } = useSWR<Category[]>(
    "/api/categories",
    fetcher
  );

  /* =====================================================
     LOAD PRODUCT
  ===================================================== */

  const {
    data: productData,
    isLoading,
    error,
  } = useSWR<ProductRecord>(
    id
      ? `/api/products/${id}`
      : null,
    fetcher
  );

  /* =====================================================
     BUILD INITIAL DATA
  ===================================================== */

  const initialData:
    | ProductPayload
    | undefined = productData
    ? mapProductToPayload(
        productData
      )
    : undefined;

  /* =====================================================
     GUARDS
  ===================================================== */

  if (loading || isLoading) {
    return (
      <div className="p-8 text-center text-gray-400">
        {t.loading ??
          "Loading..."}
      </div>
    );
  }

  if (!user || !isSeller) {
    return (
      <div className="p-8 text-center text-gray-400">
        {t.no_permission ??
          "No permission"}
      </div>
    );
  }

  if (error || !initialData) {
    return (
      <div className="p-8 text-center text-gray-400">
        {t.not_found ??
          "Product not found"}
      </div>
    );
  }

  /* =====================================================
     UPDATE
  ===================================================== */

  const updateProduct = async (
    payload: ProductPayload
  ) => {
    console.log(
      "📦 [EDIT_PRODUCT] PAYLOAD:",
      payload
    );

    const res =
      await apiAuthFetch(
        `/api/products/${id}`,
        {
          method: "PATCH",

          body: JSON.stringify(
            payload
          ),
        }
      );

    if (!res.ok) {
      const text =
        await res.text();

      console.error(
        "❌ UPDATE FAILED:",
        text
      );

      throw new Error(
        "UPDATE_FAILED"
      );
    }

    console.log(
      "✅ PRODUCT UPDATED"
    );

    router.push(
      "/seller/stock"
    );
  };

  /* =====================================================
     UI
  ===================================================== */

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <h1 className="text-xl font-bold text-center mb-4 text-[#ff6600]">
        ✏️ {t.edit_product}
      </h1>

      <ProductForm
        categories={categories}
        initialData={initialData}
        onSubmit={updateProduct}
      />
    </main>
  );
}
