import { query } from "@/lib/db";

import { mapWalletAddress } from "./mapper";

/* =========================
   MARK VALID
========================= */

export async function markWalletAddressValid(
  walletAddressId: string
) {
  const res = await query(
    `
    UPDATE wallet_addresses
    SET
      validation_status = 'valid',
      validation_error = NULL,
      validated_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [walletAddressId]
  );

  return res.rows[0]
    ? mapWalletAddress(res.rows[0])
    : null;
}

/* =========================
   MARK INVALID
========================= */

export async function markWalletAddressInvalid(
  walletAddressId: string,
  error: string
) {
  const res = await query(
    `
    UPDATE wallet_addresses
    SET
      validation_status = 'invalid',
      validation_error = $2,
      validated_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [walletAddressId, error]
  );

  return res.rows[0]
    ? mapWalletAddress(res.rows[0])
    : null;
}

/* =========================
   MARK VERIFIED
========================= */

export async function markWalletAddressVerified(
  walletAddressId: string
) {
  const res = await query(
    `
    UPDATE wallet_addresses
    SET
      is_verified = true,
      verified_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [walletAddressId]
  );

  return res.rows[0]
    ? mapWalletAddress(res.rows[0])
    : null;
}

/* =========================
   RESET VALIDATION
========================= */

export async function resetWalletAddressValidation(
  walletAddressId: string
) {
  const res = await query(
    `
    UPDATE wallet_addresses
    SET
      validation_status = 'pending',
      validation_error = NULL,
      validated_at = NULL,
      is_verified = false,
      verified_at = NULL,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [walletAddressId]
  );

  return res.rows[0]
    ? mapWalletAddress(res.rows[0])
    : null;
}
