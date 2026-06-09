import { supabase } from "@/lib/supabaseClient";

export async function getSellerAddresses(sellerId: string) {
  const { data, error } = await supabase
    .from("seller_addresses")
    .select("*")
    .eq("seller_id", sellerId)
    .order("is_default", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createSellerAddress(payload: any) {
  const { data, error } = await supabase
    .from("seller_addresses")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSellerAddress(id: string, payload: any) {
  const { data, error } = await supabase
    .from("seller_addresses")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSellerAddress(id: string) {
  const { error } = await supabase
    .from("seller_addresses")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return true;
}
