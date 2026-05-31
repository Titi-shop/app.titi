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
  console.log("[API PREVIEW CALL]", {
    url,
    payload,
  });

  const res = await apiAuthFetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  console.log("[API PREVIEW STATUS]", res.status);

  let data: unknown = null;

  try {
    data = await res.json();
  } catch (e) {
    console.error("[API PREVIEW INVALID JSON]", e);
    throw new Error("INVALID_RESPONSE");
  }

  if (!res.ok) {
    console.error("[API PREVIEW FAILED]", data);

    const errorMessage =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "PREVIEW_FAILED";
    throw new Error(errorMessage);
  }

  console.log("[API PREVIEW SUCCESS]", data);
  return data as PreviewResponse;
};
/* =========================
   LOAD ADDRESS (SAFE)
========================= */

export async function fetchDefaultAddress(): Promise<ShippingInfo | null> {
  try {
    const res = await apiAuthFetch("/api/address");

    if (!res.ok) return null;

    const data: AddressApiResponse = await res.json();

    const def = data.items?.find((a) => a.is_default);
    if (!def) return null;

    return {
      id: def.id, 
      name: def.full_name,
      phone: def.phone,
      address_line: def.address_line,
      region: def.region,
      district: def.district ?? "",
      ward: def.ward ?? "",
      country: def.country || "",
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
