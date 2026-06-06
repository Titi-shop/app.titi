"use client";

import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

/* =========================
   PREVIEW FETCHER (NO TYPE)
========================= */

export const previewFetcher = async ([
  url,
  address_id,
  zone,
  quantity,
  product_id,
  variant_id,
]) => {
  console.log("[API PREVIEW CALL]", {
    url,
    address_id,
    zone,
    quantity,
    product_id,
    variant_id,
  });

  const res = await apiAuthFetch(url, {
    method: "POST",
    body: JSON.stringify({
      address_id,
      items: [
        {
          product_id,
          variant_id: variant_id === "null" ? null : variant_id,
          quantity,
        },
      ],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "PREVIEW_FAILED");
  }

  return data;
};

/* =========================
   FETCH DEFAULT ADDRESS (NO TYPE)
========================= */

export async function fetchDefaultAddress() {
  try {
    const res = await apiAuthFetch("/api/address");

    if (!res.ok) return null;

    const data = await res.json();

    const items = Array.isArray(data?.items)
      ? data.items
      : [];

    const def = items.find((a) => a.is_default);

    if (!def) return null;

    return {
      id: def.id,
      name: def.full_name,
      phone: def.phone,
      address_line: def.address_line,
      region: def.region,
      district: def.district || "",
      ward: def.ward || "",
      country: def.country || "",
      postal_code: def.postal_code ?? null,
    };
  } catch (err) {
    console.error("[ADDRESS LOAD ERROR]", err);
    return null;
  }
}

/* =========================
   HELPER
========================= */

export function getCountryDisplay(country) {
  if (!country) return "";
  return String(country).toUpperCase();
}
