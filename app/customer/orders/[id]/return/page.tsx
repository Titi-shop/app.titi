"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  ChangeEvent,
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

type OrderItem = {
  id: string;
  product_name: string;
  thumbnail?: string | null;
};

type OrderDetail = {
  id: string;
  fulfillment_status: OrderStatus;
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

/* ================= FETCHER ================= */

const fetcher = async (url: string): Promise<OrderDetail | null> => {
  const res = await apiAuthFetch(url);
  if (!res.ok) return null;
  return res.json();
};

/* ================= IMAGE COMPRESS ================= */

async function compressImage(file: File): Promise<File> {
  const blobUrl = URL.createObjectURL(file);

  const img = new Image();

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = blobUrl;
  });

  const maxW = 1280;
  const scale = Math.min(1, maxW / img.width);

  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), file.type || "image/jpeg", 0.7)
  );

  URL.revokeObjectURL(blobUrl);

  return new File([blob], file.name, { type: file.type });
}

/* ================= PAGE ================= */

export default function OrderReturnPage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const orderId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";

  const draftKey = `return_draft_${orderId}`;

  const { data: order, isLoading } = useSWR<OrderDetail | null>(
    user && orderId ? `/api/orders/${orderId}` : null,
    fetcher,
    {
      shouldRetryOnError: false,
    }
  );

  const [items, setItems] = useState<ReturnItemState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const initialized = useRef(false);
  const dirty = useRef(false);

  const allowedStatus: OrderStatus[] = ["delivered"];

  /* ================= SAFE REDIRECT ================= */

  useEffect(() => {
    if (isLoading) return;

    if (!order) return;

    if (!allowedStatus.includes(order.fulfillment_status)) {
      setError(t.return_only_delivered ?? "Không thể hoàn đơn lúc này");
    }
  }, [order, isLoading]);

  /* ================= INIT ================= */

  useEffect(() => {
    if (!order || initialized.current) return;

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
  }, [order, draftKey]);

  /* ================= AUTOSAVE ================= */

  useEffect(() => {
    if (!initialized.current) return;

    localStorage.setItem(draftKey, JSON.stringify(items));
    dirty.current = true;
  }, [items, draftKey]);

  /* ================= GUARD LEAVE ================= */

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty.current || submitting) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [submitting]);

  const confirmLeave = useCallback(() => {
    if (!dirty.current || submitting) return true;
    return window.confirm(t.return_leave_warning ?? "Rời trang?");
  }, [submitting, t]);

  /* ================= IMAGE ================= */

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>, index: number) {
    const files = e.target.files;
    if (!files) return;

    const list = Array.from(files);

    setItems((prev) => {
      const copy = [...prev];
      const current = copy[index];

      const merged = [...current.files, ...list].slice(0, 3);

      copy[index] = {
        ...current,
        files: merged,
      };

      return copy;
    });
  }

  function removeImage(itemIndex: number, imgIndex: number) {
    setItems((prev) => {
      const copy = [...prev];
      copy[itemIndex].files.splice(imgIndex, 1);
      copy[itemIndex].previews.splice(imgIndex, 1);
      return copy;
    });
  }

  /* ================= UPLOAD ================= */

  async function uploadImages(files: File[]) {
    return Promise.all(
      files.map(async (file) => {
        const res = await apiAuthFetch("/api/returns/upload-url", {
          method: "POST",
        });

        if (!res.ok) throw new Error("UPLOAD_URL_FAILED");

        const data = await res.json();

        const upload = await fetch(data.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!upload.ok) throw new Error("UPLOAD_FAILED");

        return data.publicUrl;
      })
    );
  }

  /* ================= SUBMIT ================= */

  async function handleSubmit() {
    if (!order) return;

    const selected = items.filter((i) => i.selected);

    if (!selected.length) {
      setError(t.return_select_item);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      for (const item of selected) {
        const reason =
          item.reasonValue === "other"
            ? item.reasonText
            : item.reasonValue;

        if (!reason) throw new Error(t.return_reason_required);
        if (!item.files.length) throw new Error(t.return_upload_required);

        const urls = await uploadImages(item.files);

        const res = await apiAuthFetch("/api/returns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            orderItemId: item.orderItemId,
            reason,
            images: urls,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "FAILED");
        }
      }

      localStorage.removeItem(draftKey);
      dirty.current = false;

      router.push("/customer/returns");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ERROR");
    } finally {
      setSubmitting(false);
    }
  }

  /* ================= LOADING ================= */

  if (isLoading || loading) {
    return <p className="p-4">{t.loading}</p>;
  }

  /* ================= ORDER NULL SAFE ================= */

  if (!order) {
    return (
      <div className="p-4 space-y-2">
        <p className="text-red-500">{t.order_not_found}</p>
        <button onClick={() => router.push("/customer/orders")}>
          {t.back}
        </button>
      </div>
    );
  }

  const itemsList = order.order_items ?? [];

  /* ================= UI ================= */

  return (
    <main className="min-h-screen p-4 space-y-4 bg-gray-100">
      <div className="bg-white p-4 rounded-xl shadow">
        <h1 className="font-semibold">🔄 {t.return_request}</h1>
      </div>

      {itemsList.map((item, index) => {
        const state = items[index];

        if (!state) return null;

        return (
          <div key={item.id} className="bg-white p-4 rounded-xl shadow">
            <div className="flex gap-3 items-center">
              <input
                type="checkbox"
                checked={state.selected}
                onChange={(e) => {
                  const copy = [...items];
                  copy[index].selected = e.target.checked;
                  setItems(copy);
                }}
              />

              {item.thumbnail && (
                <img
                  src={item.thumbnail}
                  className="w-12 h-12 rounded object-cover"
                />
              )}

              <p>{item.product_name}</p>
            </div>

            {state.selected && (
              <div className="mt-3 space-y-2">
                <select
                  value={state.reasonValue}
                  onChange={(e) => {
                    const copy = [...items];
                    copy[index].reasonValue = e.target.value;
                    setItems(copy);
                  }}
                >
                  <option value="">{t.return_select_reason}</option>
                  <option value="damaged">Damaged</option>
                  <option value="wrong_item">Wrong item</option>
                  <option value="other">Other</option>
                </select>

                <div className="flex gap-2">
                  {state.files.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => removeImage(index, i)}
                    >
                      ×
                    </button>
                  ))}
                </div>

                <input
                  type="file"
                  multiple
                  onChange={(e) => handleImageChange(e, index)}
                />
              </div>
            )}
          </div>
        );
      })}

      {error && <p className="text-red-500">{error}</p>}

      <button
        disabled={submitting}
        onClick={() => confirmLeave() && handleSubmit()}
        className="w-full bg-black text-white p-4 rounded"
      >
        {submitting ? t.return_submitting : t.return_submit}
      </button>
    </main>
  );
    }
