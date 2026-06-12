"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import {
  useState,
  useEffect,
  ChangeEvent,
  useRef,
  useCallback,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* ================= TYPES ================= */

type OrderStatus =
  | "pending_fulfillment"
  | "processing"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded";

type ReturnStatus =
  | "pending"
  | "approved"
  | "shipping_back"
  | "received"
  | "refunded"
  | "rejected";

type OrderItem = {
  id: string;
  product_name: string;
  thumbnail?: string;
};

type OrderDetail = {
  id: string;
  fulfillment_status: OrderStatus;
  return_status?: ReturnStatus | null;
  order_items: OrderItem[];
};

type ReturnItemState = {
  orderItemId: string;
  selected: boolean;
  reasonValue: string;
  reasonText: string;
  files: File[];
  previews: string[];
};

/* ================= CONSTANT ================= */

const ALLOWED_RETURN_STATUS: OrderStatus[] = ["delivered"];

/* ================= FETCHER ================= */

const fetcher = async (url: string): Promise<OrderDetail | null> => {
  const res = await apiAuthFetch(url);
  const data = await res.json();

  if (!res.ok || !data?.order) return null;

  return data.order as OrderDetail;
};

/* ================= IMAGE COMPRESS ================= */

async function compressImage(file: File): Promise<File> {
  const type = file.type || "image/jpeg";

  const img = document.createElement("img");
  const blobUrl = URL.createObjectURL(file);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = blobUrl;
  });

  const maxW = 1280;
  const scale = Math.min(1, maxW / img.width);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b as Blob), type, 0.7);
  });

  URL.revokeObjectURL(blobUrl);

  return new File([blob], file.name, { type });
}

/* ================= PAGE ================= */

export default function OrderReturnPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const orderId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id ?? "";

  const draftKey = `return_draft_${orderId}`;

  const [items, setItems] = useState<ReturnItemState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const initialized = useRef(false);
  const isDirtyRef = useRef(false);

  const { data: order, isLoading } = useSWR(
    user && orderId ? `/api/orders/${orderId}` : null,
    fetcher
  );

  /* ================= SAFE GUARD (FIX CRASH) ================= */

  if (isLoading || authLoading) {
    return <p className="p-4">{t.loading}</p>;
  }

  if (!order?.id || !Array.isArray(order.order_items)) {
    return <p className="p-4 text-red-500">{t.order_not_found}</p>;
  }

  if (order.return_status) {
    router.replace(`/customer/orders/${order.id}`);
    return null;
  }

  /* ================= STATUS CHECK ================= */

  useEffect(() => {
    if (!order?.id) return;

    if (order.return_status) {
      router.replace(`/customer/orders/${order.id}`);
      return;
    }

    if (!ALLOWED_RETURN_STATUS.includes(order.fulfillment_status)) {
      setError(
        t.return_only_delivered ??
          "Chỉ được hoàn đơn khi đơn đã giao"
      );
    }
  }, [order, router, t]);

  /* ================= INIT ================= */

  useEffect(() => {
    if (!order || initialized.current) return;

    const allowed = ALLOWED_RETURN_STATUS.includes(
      order.fulfillment_status
    );

    if (!allowed) return;

    const saved = localStorage.getItem(draftKey);

    if (saved) {
      try {
        setItems(JSON.parse(saved));
        initialized.current = true;
        return;
      } catch {}
    }

    setItems(
      order.order_items.map((i) => ({
        orderItemId: i.id,
        selected: false,
        reasonValue: "",
        reasonText: "",
        files: [],
        previews: [],
      }))
    );

    initialized.current = true;
  }, [order]);

  /* ================= AUTOSAVE ================= */

  useEffect(() => {
    if (!initialized.current) return;

    localStorage.setItem(draftKey, JSON.stringify(items));
    isDirtyRef.current = true;
  }, [items]);

  /* ================= LEAVE WARNING ================= */

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current || submitting) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [submitting]);

  const confirmLeave = useCallback(() => {
    if (!isDirtyRef.current || submitting) return true;
    return window.confirm(t.return_leave_warning);
  }, [submitting, t]);

  /* ================= IMAGE ================= */

  async function handleImageChange(
    e: ChangeEvent<HTMLInputElement>,
    index: number
  ) {
    const files = e.target.files;
    if (!files) return;

    const selected = Array.from(files);

    const updated = [...items];
    const current = updated[index];

    let merged = [...current.files, ...selected].slice(0, 3);

    const compressed = await Promise.all(
      merged.map(compressImage)
    );

    current.files.forEach((f) => f && URL.revokeObjectURL(f as any));

    current.files = compressed;
    current.previews = compressed.map((f) =>
      URL.createObjectURL(f)
    );

    setItems([...updated]);
  }

  function removeImage(index: number, imgIndex: number) {
    const updated = [...items];

    updated[index].files.splice(imgIndex, 1);
    updated[index].previews.splice(imgIndex, 1);

    setItems([...updated]);
  }

  /* ================= UPLOAD ================= */

  async function uploadImages(files: File[]): Promise<string[]> {
    return Promise.all(
      files.map(async (file) => {
        const res = await apiAuthFetch("/api/returns/upload-url", {
          method: "POST",
        });

        const data = await res.json();

        await fetch(data.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        return data.publicUrl as string;
      })
    );
  }

  /* ================= SUBMIT ================= */

  async function handleSubmit() {
    const selected = items.filter((i) => i.selected);

    if (!selected.length) {
      setError(t.return_select_item);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await Promise.all(
        selected.map(async (item) => {
          const reason =
            item.reasonValue === "other"
              ? item.reasonText
              : item.reasonValue;

          if (!reason?.trim()) {
            throw new Error(t.return_reason_required);
          }

          if (!item.files.length) {
            throw new Error(t.return_upload_required);
          }

          const images = await uploadImages(item.files);

          await apiAuthFetch("/api/returns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId,
              orderItemId: item.orderItemId,
              reason,
              images,
            }),
          });
        })
      );

      localStorage.removeItem(draftKey);
      isDirtyRef.current = false;

      router.push("/customer/returns");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.system_error);
    } finally {
      setSubmitting(false);
    }
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 p-4 space-y-4">
      <div className="bg-white p-4 rounded-xl shadow">
        <h1 className="text-lg font-semibold">
          🔄 {t.return_request}
        </h1>
      </div>

      {order.order_items.map((item, index) => {
        const state = items[index];
        if (!state) return null;

        return (
          <div
            key={item.id}
            className="bg-white p-4 rounded-xl shadow space-y-3"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={state.selected}
                onChange={(e) => {
                  const updated = [...items];
                  updated[index].selected = e.target.checked;
                  setItems(updated);
                }}
              />

              <img
                src={item.thumbnail}
                className="w-12 h-12 rounded"
              />

              <span>{item.product_name}</span>
            </div>
          </div>
        );
      })}

      {error && (
        <p className="text-red-500 bg-red-50 p-3 rounded">
          {error}
        </p>
      )}

      <button
        onClick={() => confirmLeave() && handleSubmit()}
        disabled={submitting}
        className="w-full bg-black text-white py-3 rounded"
      >
        {submitting ? t.return_submitting : t.return_submit}
      </button>
    </main>
  );
}
