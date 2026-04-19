"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useAuth } from "@/context/AuthContext";

/* ================= TYPES ================= */

type ReturnStatus =
  | "pending"
  | "approved"
  | "shipping_back"
  | "received"
  | "refunded"
  | "rejected";

type ReturnItem = {
  id: string;
  return_number: string;
  status: ReturnStatus;
  created_at: string;

  product_name: string;
  thumbnail: string;
  quantity: number;

  reason?: string;
  evidence_images?: string[];
};

/* ================= TIMELINE ================= */

const timelineSteps = [
  "pending",
  "approved",
  "shipping_back",
  "received",
  "refunded",
];

function getStepIndex(status: ReturnStatus) {
  return timelineSteps.indexOf(status);
}

/* ================= PAGE ================= */

export default function SellerReturnsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [preview, setPreview] = useState<ReturnItem | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  /* ================= LOAD ================= */

  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [authLoading, user]);

  async function load() {
    try {
      const res = await apiAuthFetch("/api/seller/returns");
      const json = await res.json();
      setItems(json.items ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /* ================= ACTION ================= */

  async function action(id: string, type: string) {
    await apiAuthFetch(`/api/seller/returns/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: type }),
    });

    await load();
    setPreview(null);
  }

  /* ================= UI ================= */

  if (loading) return <p className="p-4">Loading...</p>;

  return (
    <main className="p-4 max-w-xl mx-auto space-y-4">

      <h1 className="text-lg font-bold">
        🔄 Seller Returns
      </h1>

      {items.map((item) => (
        <div
          key={item.id}
          className="bg-white p-3 rounded-xl shadow-sm flex gap-3"
        >
          <img
            src={item.thumbnail}
            className="w-20 h-20 object-cover rounded"
          />

          <div className="flex-1">

            <p className="text-sm font-medium">
              {item.product_name}
            </p>

            <p className="text-xs text-gray-400">
              {new Date(item.created_at).toLocaleString()}
            </p>

            <div className="flex justify-between mt-2">

              <span className="text-xs text-gray-600">
                {item.status}
              </span>

              <button
                onClick={() => {
                  setPreview(item);
                  setCurrentIndex(0);
                }}
                className="text-xs text-blue-600"
              >
                Xem ảnh
              </button>

            </div>
          </div>
        </div>
      ))}

      {/* ================= PREVIEW ================= */}

      {preview && (
        <PreviewModal
          preview={preview}
          currentIndex={currentIndex}
          setCurrentIndex={setCurrentIndex}
          onClose={() => setPreview(null)}
          onAction={action}
        />
      )}

    </main>
  );
}

/* ================= PREVIEW ================= */

function PreviewModal({
  preview,
  currentIndex,
  setCurrentIndex,
  onClose,
  onAction,
}: {
  preview: ReturnItem;
  currentIndex: number;
  setCurrentIndex: (i: number) => void;
  onClose: () => void;
  onAction: (id: string, type: string) => void;
}) {
  const images = [
    preview.thumbnail,
    ...(preview.evidence_images ?? []),
  ];

  const stepIndex = getStepIndex(preview.status);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">

      {/* HEADER */}
      <div className="flex justify-between p-3 text-white">
        <button onClick={onClose}>←</button>
        <span>{currentIndex + 1}/{images.length}</span>
        <span />
      </div>

      {/* IMAGE */}
      <div className="flex-1 flex items-center justify-center relative">

        <img
          src={images[currentIndex]}
          className="max-h-full max-w-full object-contain"
        />

        {currentIndex > 0 && (
          <button
            onClick={() => setCurrentIndex(currentIndex - 1)}
            className="absolute left-2 text-white text-2xl"
          >
            ‹
          </button>
        )}

        {currentIndex < images.length - 1 && (
          <button
            onClick={() => setCurrentIndex(currentIndex + 1)}
            className="absolute right-2 text-white text-2xl"
          >
            ›
          </button>
        )}
      </div>

      {/* INFO */}
      <div className="bg-white p-4 space-y-3">

        <p className="text-sm font-semibold">
          {preview.product_name}
        </p>

        <p className="text-xs text-gray-500">
          {new Date(preview.created_at).toLocaleString()}
        </p>

        {preview.reason && (
          <p className="text-xs text-gray-600">
            Reason: {preview.reason}
          </p>
        )}

        {/* ================= TIMELINE ================= */}

        <div className="flex items-center justify-between mt-3">

          {timelineSteps.map((step, i) => (
            <div key={step} className="flex-1 text-center">

              <div
                className={`w-6 h-6 mx-auto rounded-full ${
                  i <= stepIndex
                    ? "bg-black"
                    : "bg-gray-300"
                }`}
              />

              <p className="text-[10px] mt-1">
                {step}
              </p>

              {i < timelineSteps.length - 1 && (
                <div
                  className={`h-[2px] ${
                    i < stepIndex
                      ? "bg-black"
                      : "bg-gray-300"
                  }`}
                />
              )}

            </div>
          ))}

        </div>

        {/* ACTION */}
        {preview.status === "pending" && (
          <div className="flex gap-2 pt-3">

            <button
              onClick={() => onAction(preview.id, "approve")}
              className="flex-1 bg-green-500 text-white py-2 rounded"
            >
              Approve
            </button>

            <button
              onClick={() => onAction(preview.id, "reject")}
              className="flex-1 bg-red-500 text-white py-2 rounded"
            >
              Reject
            </button>

          </div>
        )}

      </div>
    </div>
  );
}
