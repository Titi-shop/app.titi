/* =========================================================
   TYPES
========================================================= */

export type WalletNetwork =
  | "pi";

export type WalletAddressStatus =
  | "active"
  | "inactive"
  | "disabled"
  | "deleted";

export type WalletValidationStatus =
  | "pending"
  | "valid"
  | "invalid";

/* =========================================================
   ENTITY
========================================================= */

export interface WalletAddress {
  id: string;

  wallet_id: string;
  user_id: string;

  network: WalletNetwork;

  address: string;

  label: string | null;

  status: WalletAddressStatus;

  is_default: boolean;

  validation_status: WalletValidationStatus;
  validation_error: string | null;

  validated_at: Date | null;

  is_verified: boolean;
  verified_at: Date | null;

  used_count: number;

  last_used_at: Date | null;

  created_at: Date;
  updated_at: Date;

  deleted_at: Date | null;

  created_by: string | null;
  updated_by: string | null;
}

/* =========================================================
   CREATE
========================================================= */

export interface CreateWalletAddressInput {
  wallet_id: string;

  user_id: string;

  network?: WalletNetwork;

  address: string;

  label?: string | null;

  is_default?: boolean;

  created_by?: string | null;
}

/* =========================================================
   UPDATE LABEL
========================================================= */

export interface UpdateWalletAddressLabelInput {
  label: string | null;

  updated_by?: string | null;
}
