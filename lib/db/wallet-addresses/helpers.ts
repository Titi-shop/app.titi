import type {
  WalletAddressStatus,
  WalletNetwork,
  WalletValidationStatus,
} from "./types";

/* =========================================================
   UUID
========================================================= */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    UUID_REGEX.test(value)
  );
}

/* =========================================================
   NETWORK
========================================================= */

export function normalizeNetwork(
  network?: string | null
): WalletNetwork {
  return "pi";
}

/* =========================================================
   STATUS
========================================================= */

export function normalizeStatus(
  status?: string | null
): WalletAddressStatus {
  switch (status) {
    case "inactive":
    case "disabled":
    case "deleted":
      return status;

    default:
      return "active";
  }
}

/* =========================================================
   VALIDATION STATUS
========================================================= */

export function normalizeValidationStatus(
  status?: string | null
): WalletValidationStatus {
  switch (status) {
    case "valid":
    case "invalid":
      return status;

    default:
      return "pending";
  }
}

/* =========================================================
   LABEL
========================================================= */

export function normalizeLabel(
  label?: string | null
): string | null {
  const value = label?.trim();

  if (!value) {
    return null;
  }

  return value.slice(0, 100);
}

/* =========================================================
   ADDRESS
========================================================= */

export function normalizeAddress(
  address: string
): string {
  return address.trim();
}
