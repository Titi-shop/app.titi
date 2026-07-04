// =====================================================
// lib/db/wallet-security/queries.lock.ts
// =====================================================

import {
  query,
} from "@/lib/db";

import {
  mapWalletSecurity,
} from "./mapper";

/* =====================================================
   INCREMENT FAILED ATTEMPTS
===================================================== */

export async function incrementWalletFailedAttempts(
  userId: string
) {

  const res =
    await query(
      `
      UPDATE wallet_security

      SET

        failed_attempts =
          failed_attempts + 1,

        updated_at = NOW()

      WHERE user_id = $1

      RETURNING *
      `,
      [
        userId,
      ]
    );

  return res.rows[0]
    ? mapWalletSecurity(
        res.rows[0]
      )
    : null;

}

/* =====================================================
   RESET FAILED ATTEMPTS
===================================================== */

export async function resetWalletFailedAttempts(
  userId: string
) {

  const res =
    await query(
      `
      UPDATE wallet_security

      SET

        failed_attempts = 0,

        locked_until = NULL,

        updated_at = NOW()

      WHERE user_id = $1

      RETURNING *
      `,
      [
        userId,
      ]
    );

  return res.rows[0]
    ? mapWalletSecurity(
        res.rows[0]
      )
    : null;

}

/* =====================================================
   LOCK WALLET
===================================================== */

export async function lockWalletSecurity(
  userId: string,
  lockedUntil: Date
) {

  const res =
    await query(
      `
      UPDATE wallet_security

      SET

        locked_until = $2,

        updated_at = NOW()

      WHERE user_id = $1

      RETURNING *
      `,
      [
        userId,
        lockedUntil,
      ]
    );

  return res.rows[0]
    ? mapWalletSecurity(
        res.rows[0]
      )
    : null;

}

/* =====================================================
   UNLOCK WALLET
===================================================== */

export async function unlockWalletSecurity(
  userId: string
) {

  const res =
    await query(
      `
      UPDATE wallet_security

      SET

        failed_attempts = 0,

        locked_until = NULL,

        updated_at = NOW()

      WHERE user_id = $1

      RETURNING *
      `,
      [
        userId,
      ]
    );

  return res.rows[0]
    ? mapWalletSecurity(
        res.rows[0]
      )
    : null;

}
