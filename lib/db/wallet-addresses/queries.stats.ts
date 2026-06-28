import { query } from "@/lib/db";

import { mapWalletAddress } from "./mapper";

/* =========================
   INCREMENT USAGE
========================= */

export async function incrementWalletAddressUsage(
  walletAddressId: string
) {
  const res = await query(
    `
    UPDATE wallet_addresses
    SET
      used_count = used_count + 1,
      last_used_at = NOW(),
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
   TOUCH LAST USED
========================= */

export async function touchWalletAddress(
  walletAddressId: string
) {
  const res = await query(
    `
    UPDATE wallet_addresses
    SET
      last_used_at = NOW(),
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
   RESET USAGE
========================= */

export async function resetWalletAddressUsage(
  walletAddressId: string
) {
  const res = await query(
    `
    UPDATE wallet_addresses
    SET
      used_count = 0,
      last_used_at = NULL,
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
