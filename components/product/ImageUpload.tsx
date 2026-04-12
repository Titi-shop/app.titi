"use client";

import Image from "next/image";
import { uploadImage } from "@/lib/supabase/upload";

export default function ImageUpload({
  images,
  setImages,
}: {
  images: string[];
  setImages: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async (files: File[]) => {
    if (!files.length) return;

    try {
      const urls = await Promise.all(
        files.map((file) => uploadImage(file))
      );

      setImages((prev) => [...prev, ...urls]);

    } catch (err) {
      console.error("❌ Upload error:", err);
      alert("Upload failed");
    }
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* IMAGE LIST */}
      {images.map((url, i) => (
        <div key={url} className="relative h-28">
          <Image src={url} alt="" fill className="object-cover rounded" />

          <button
            type="button"
            onClick={() => removeImage(i)}
            className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 rounded"
          >
            ✕
          </button>
        </div>
      ))}

      {/* UPLOAD */}
      {images.length < 6 && (
        <label className="flex items-center justify-center border-2 border-dashed rounded cursor-pointer h-28">
          ＋
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) =>
              handleUpload(Array.from(e.target.files || []))
            }
          />
        </label>
      )}
    </div>
  );
}
