import { supabase } from "./client";

export async function uploadImage(file: File) {
  const fileExt = file.name.split(".").pop();
  const fileName = `products/${Date.now()}-${Math.random()}.${fileExt}`;

  const { error } = await supabase.storage
    .from("products") // 👈 bucket
    .upload(fileName, file);

  if (error) {
    console.error("❌ SUPABASE UPLOAD ERROR:", error);
    throw error;
  }

  const { data } = supabase.storage
    .from("products")
    .getPublicUrl(fileName);

  return data.publicUrl;
}
