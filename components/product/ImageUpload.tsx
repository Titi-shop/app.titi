// components/product/ImageUpload.tsx

import Image from "next/image";

export default function ImageUpload({ images, setImages, uploadImages }: any) {
  const removeImage = (index: number) => {
    setImages((prev: string[]) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {images.map((url: string, i: number) => (
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

      {images.length < 6 && (
        <label className="flex items-center justify-center border-2 border-dashed rounded cursor-pointer h-28">
          ＋
          <input
            type="file"
            multiple
            hidden
            onChange={(e) =>
              uploadImages(Array.from(e.target.files || []), setImages)
            }
          />
        </label>
      )}
    </div>
  );
}
