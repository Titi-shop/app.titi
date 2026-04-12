"use client";

import { useProductForm } from "./useProductForm";
import ImageUpload from "./ImageUpload";
import VariantEditor from "./VariantEditor";
import ShippingRates from "./ShippingRates";
import { useAuth } from "@/context/AuthContext";

export default function ProductForm({ categories, initialData, onSubmit }: any) {
  const { user, loading } = useAuth();
  const form = useProductForm(initialData);

  if (loading || !user) return <div>Loading...</div>;

  return (
    <form className="space-y-4">
      <input
        value={form.name}
        onChange={(e) => form.setName(e.target.value)}
      />

      <ImageUpload
        images={form.images}
        setImages={form.setImages}
        uploadImages={() => {}}
      />

      <ShippingRates
        shippingRates={form.shippingRates}
        setShippingRates={form.setShippingRates}
      />

      <VariantEditor
        variants={form.variants}
        setVariants={form.setVariants}
      />
    </form>
  );
}
