"use client";

import useSWR from "swr";
import { useRouter, useParams } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import ProductForm from "@/components/ProductForm";

/* ================= TYPES ================= */

interface Category {
  id: string;
  key: string;
}

interface ProductPayload {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  saleStart?: string | null;
  saleEnd?: string | null;
  description: string;
  detail: string;
  images: string[];
  thumbnail: string;
  categoryId: string;
  stock: number;
  isActive: boolean;

  // 🔥 QUAN TRỌNG
  shippingRates?: { zone: string; price: number }[];

  variants?: any[];
}

/* ================= FETCHER ================= */

const fetcher = (url: string) =>
  apiAuthFetch(url, { cache: "no-store" }).then((res) =>
    res.ok ? res.json() : null
  );

/* ================= TIME FIX ================= */

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);

  return local.toISOString().slice(0, 16);
}

/* ================= PAGE ================= */

export default function SellerEditPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { user, loading } = useAuth();

  const isSeller = user?.role === "seller";
  const id = typeof params.id === "string" ? params.id : "";

  /* ================= LOAD ================= */

  const { data: categories = [] } = useSWR("/api/categories", fetcher);

  const { data: productData, isLoading } = useSWR(
    id ? `/api/products/${id}` : null,
    fetcher
  );

  /* ================= BUILD PRODUCT ================= */

  const product: ProductPayload | null = productData
    ? {
        ...productData,

        // 🔥 FIX TIME
        saleStart: toDateTimeLocal(productData.saleStart),
        saleEnd: toDateTimeLocal(productData.saleEnd),

        // 🔥 GIỮ NGUYÊN ARRAY (KHÔNG MAP)
        shippingRates: productData.shippingRates || [],

        variants: productData.variants || [],
      }
    : null;

  /* ================= GUARD ================= */

  if (loading || isLoading) {
    return (
      <div className="p-8 text-center text-gray-400">
        {t.loading ?? "Loading..."}
      </div>
    );
  }

  if (!user || !isSeller) {
    return (
      <div className="p-8 text-center text-gray-400">
        {t.no_permission ?? "No permission"}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center text-gray-400">
        {t.not_found ?? "Product not found"}
      </div>
    );
  }

  /* ================= UPDATE ================= */

  const updateProduct = async (payload: ProductPayload) => {
    console.log("📦 [EDIT] SUBMIT:", payload);

    const res = await apiAuthFetch(`/api/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("❌ PATCH FAILED");
      throw new Error("PATCH_FAILED");
    }

    console.log("✅ UPDATE SUCCESS");

    router.push("/seller/stock");
  };

  /* ================= UI ================= */

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <h1 className="text-xl font-bold text-center mb-4 text-[#ff6600]">
        ✏️ {t.edit_product}
      </h1>

      <ProductForm
        categories={categories}
        initialData={product}
        onSubmit={updateProduct}
      />
    </main>
  );
}
