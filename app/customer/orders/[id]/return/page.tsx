"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import { useState, ChangeEvent, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

/* ================= TYPES ================= */

type OrderStatus =
  | "pending"
  | "pickup"
  | "shipping"
  | "completed"
  | "cancelled";

type OrderItem = {
  id: string;
  product_name: string;
};

type OrderDetail = {
  id: string;
  status: OrderStatus;
  order_items: OrderItem[];
};

/* ================= FETCHER ================= */

const fetcher = async (url: string): Promise<OrderDetail | null> => {
  const res = await apiAuthFetch(url);

  if (!res.ok) return null;

  return res.json();
};

/* ================= PAGE ================= */

export default function OrderReturnPage() {

  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const orderId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : "";

  /* ================= STATE ================= */

  const [orderItemId, setOrderItemId] = useState("");

  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* ================= SWR ================= */

  const {
    data: order,
    isLoading,
  } = useSWR(
    user && orderId ? `/api/orders/${orderId}` : null,
    fetcher
  );

  /* ================= VALIDATE ORDER ================= */

  useEffect(() => {
    if (!order) return;

    if (order.status !== "completed") {
      setError(
        t.return_only_completed ??
          "Only completed orders can be returned"
      );
      return;
    }

    if (order.order_items?.length > 0) {
      setOrderItemId(order.order_items[0].id);
    }
  }, [order, t]);

  /* ================= IMAGE ================= */

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {

    const files = e.target.files;
    if (!files) return;

    const selected = Array.from(files).slice(0, 3);

    for (const file of selected) {
      if (file.size > 2 * 1024 * 1024) {
        setError("Image must be under 2MB");
        return;
      }
    }

    setImages(selected);

    const urls = selected.map((file) =>
      URL.createObjectURL(file)
    );

    setPreviews(urls);
  }

  // cleanup preview memory leak
  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  /* ================= SUBMIT ================= */

  async function handleSubmit() {

    if (!orderItemId) {
      setError("Order item not found");
      return;
    }

    if (!reason.trim()) {
      setError(t.return_reason_required ?? "Return reason required");
      return;
    }

    if (images.length === 0) {
      setError(t.return_image_required ?? "Please upload product images");
      return;
    }

    try {

      setSubmitting(true);
      setError(null);

      const formData = new FormData();

      formData.append("order_id", orderId);
      formData.append("order_item_id", orderItemId);
      formData.append("reason", reason);
      formData.append("description", description);

      images.forEach((img) => {
        formData.append("images", img);
      });

      const res = await apiAuthFetch("/api/returns", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {

        const data = await res.json().catch(() => null);

        setError(
          data?.error ??
          t.return_submit_failed ??
          "Failed to submit return request"
        );

        return;
      }

      router.push("/customer/returns");

    } catch {

      setError(t.system_error ?? "System error");

    } finally {

      setSubmitting(false);

    }
  }

  /* ================= UI ================= */

  if (isLoading || authLoading) {
    return (
      <main className="p-4">
        <p>{t.loading ?? "Loading..."}</p>
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="p-4">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  return (

    <main className="p-4 max-w-xl mx-auto space-y-4">

      <h1 className="text-xl font-bold">
        🔄 {t.return_request ?? "Return request"}
      </h1>

      <div className="border p-3 rounded-md text-sm">

        <p>
          {t.order_id ?? "Order"}: {order?.id}
        </p>

        <p>
          {t.status ?? "Status"}: {order?.status}
        </p>

      </div>

      {/* REASON */}
      <div className="space-y-2">

        <label className="block text-sm font-medium">
          {t.return_reason ?? "Return reason"}
        </label>

        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border rounded-md p-2 text-sm"
          placeholder={t.return_reason_example ?? "Example: product defect"}
        />

      </div>

      {/* DESCRIPTION */}
      <div className="space-y-2">

        <label className="block text-sm font-medium">
          {t.description ?? "Description"}
        </label>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border rounded-md p-2 text-sm"
          rows={4}
        />

      </div>

      {/* IMAGE */}
      <div className="space-y-2">

        <label className="block text-sm font-medium">
          {t.upload_images ?? "Upload product images"} (max 3)
        </label>

        <input
          id="fileUpload"
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageChange}
          className="hidden"
        />

        <label
          htmlFor="fileUpload"
          className="inline-block bg-gray-200 px-3 py-2 rounded cursor-pointer text-sm"
        >
          {t.choose_file ?? "Choose file"}
        </label>

        <p className="text-sm text-gray-500">
          {images.length === 0
            ? t.no_file_selected ?? "No file selected"
            : `${images.length} ${t.photos_selected ?? "photos selected"}`}
        </p>

        {previews.length > 0 && (
          <div className="flex gap-2">
            {previews.map((src, i) => (
              <div key={i} className="w-20 h-20 border rounded overflow-hidden">
                <img
                  src={src}
                  alt="preview"
                  className="object-cover w-full h-full"
                />
              </div>
            ))}
          </div>
        )}

      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-black text-white rounded-md p-2 text-sm disabled:opacity-50"
      >
        {submitting
          ? t.submitting ?? "Submitting..."
          : t.submit_return ?? "Submit return request"}
      </button>

    </main>
  );
}
