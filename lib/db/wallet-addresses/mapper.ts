import type { WalletAddress } from "./types";

/* =========================================================
   MAP ROW
========================================================= */

export function mapWalletAddress(
  row: any
): WalletAddress {
  return {
    id: row.id,

    wallet_id: row.wallet_id,
    user_id: row.user_id,

    network: row.network,

    address: row.address,

    label: row.label,

    status: row.status,

    is_default: row.is_default,

    validation_status: row.validation_status,
    validation_error: row.validation_error,

    validated_at: row.validated_at,

    is_verified: row.is_verified,
    verified_at: row.verified_at,

    used_count: Number(row.used_count ?? 0),

    last_used_at: row.last_used_at,

    created_at: row.created_at,
    updated_at: row.updated_at,

    deleted_at: row.deleted_at,

    created_by: row.created_by,
    updated_by: row.updated_by,
  };
}
