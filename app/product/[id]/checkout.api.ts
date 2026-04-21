import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

import type {
  PreviewPayload,
  PreviewResponse,
  AddressApiResponse,
  ShippingInfo,
} from "./checkout.types";

/* =========================
   PREVIEW FETCHER (SAFE)
========================= */

export const previewFetcher = async (
  [url, payload]: [string, PreviewPayload]
): Promise<PreviewResponse> => {
  /* ===== NORMALIZE ===== */
  const safePayload: PreviewPayload = {
    country: payload.country,
    zone: payload.zone,
    shipping: {
      region: payload.shipping.region,
      district: payload.shipping.district ?? "",
      ward: payload.shipping.ward ?? "",
    },
    items: payload.items.map((i) => ({
      product_id: i.product_id,
      variant_id: i.variant_id ?? null,
      quantity: Number(i.quantity) || 1,
    })),
  };

  const res = await apiAuthFetch(url, {
    method: "POST",
    body: JSON.stringify(safePayload),
  });

  let data: unknown = null;

  try {
    data = await res.json();
  } catch {
    throw new Error("INVALID_RESPONSE");
  }

  if (!res.ok) {
    throw new Error(
      typeof (data as any)?.error === "string"
        ? (data as any).error
        : "PREVIEW_FAILED"
    );
  }

  return data as PreviewResponse;
};

/* =========================
   LOAD ADDRESS (SAFE)
========================= */

export async function fetchDefaultAddress(): Promise<ShippingInfo | null> {
  try {
    const res = await apiAuthFetch("/api/address");

    if (!res.ok) {
      return null;
    }

    const data: AddressApiResponse = await res.json();

    const def = data.items?.find((a) => a.is_default);
    if (!def) return null;

    return {
      name: def.full_name,
      phone: def.phone,
      address_line: def.address_line,
      region: def.region,
      district: def.district ?? "",
      ward: def.ward ?? "",
      country: def.country || "VN",
      postal_code: def.postal_code ?? null,
    };
  } catch {
    return null;
  }
}

/* =========================
   HELPER
========================= */

export function getCountryDisplay(country?: string) {
  if (!country) return "";

  return country.toUpperCase();
}
