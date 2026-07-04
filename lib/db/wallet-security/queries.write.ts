// =====================================================
// lib/db/wallet-security/queries.write.ts
// =====================================================

import {
  query,
} from "@/lib/db";

import {
  mapWalletSecurity,
} from "./mapper";

import type {
  CreateWalletSecurityInput,
  SetWalletPinInput,
  ChangeWalletPinInput,
  EnableTotpInput,
  EnableBiometricInput,
  EnablePasskeyInput,
} from "./types";

/* =====================================================
   CREATE
===================================================== */

export async function createWalletSecurity(
  input: CreateWalletSecurityInput
) {

  const res =
    await query(
      `
      INSERT INTO wallet_security (

        user_id,

        created_by

      )

      VALUES (

        $1,

        $2

      )

      RETURNING *
      `,
      [

        input.user_id,

        input.created_by ??
          null,

      ]
    );

  return mapWalletSecurity(
    res.rows[0]
  );

}

/* =====================================================
   SET PIN
===================================================== */

export async function setWalletPin(
  input: SetWalletPinInput
) {

  const res =
    await query(
      `
      UPDATE wallet_security

      SET

        pin_hash = $2,

        pin_enabled = true,

        pin_created_at = NOW(),

        pin_changed_at = NOW(),

        updated_at = NOW(),

        updated_by = $3

      WHERE user_id = $1

      RETURNING *
      `,
      [

        input.user_id,

        input.pin_hash,

        input.updated_by ??
          null,

      ]
    );

  return res.rows[0]
    ? mapWalletSecurity(
        res.rows[0]
      )
    : null;

}

/* =====================================================
   CHANGE PIN
===================================================== */

export async function changeWalletPin(
  input: ChangeWalletPinInput
) {

  const res =
    await query(
      `
      UPDATE wallet_security

      SET

        pin_hash = $2,

        pin_changed_at = NOW(),

        updated_at = NOW(),

        updated_by = $3

      WHERE user_id = $1

      RETURNING *
      `,
      [

        input.user_id,

        input.pin_hash,

        input.updated_by ??
          null,

      ]
    );

  return res.rows[0]
    ? mapWalletSecurity(
        res.rows[0]
      )
    : null;

}

/* =====================================================
   ENABLE TOTP
===================================================== */

export async function enableWalletTotp(
  input: EnableTotpInput
) {

  const res =
    await query(
      `
      UPDATE wallet_security

      SET

        totp_enabled = true,

        totp_secret = $2,

        totp_created_at = NOW(),

        updated_at = NOW()

      WHERE user_id = $1

      RETURNING *
      `,
      [

        input.user_id,

        input.secret,

      ]
    );

  return res.rows[0]
    ? mapWalletSecurity(
        res.rows[0]
      )
    : null;

}

/* =====================================================
   BIOMETRIC
===================================================== */

export async function setWalletBiometric(
  input: EnableBiometricInput
) {

  const res =
    await query(
      `
      UPDATE wallet_security

      SET

        biometric_enabled = $2,

        updated_at = NOW()

      WHERE user_id = $1

      RETURNING *
      `,
      [

        input.user_id,

        input.enabled,

      ]
    );

  return res.rows[0]
    ? mapWalletSecurity(
        res.rows[0]
      )
    : null;

}

/* =====================================================
   PASSKEY
===================================================== */

export async function setWalletPasskey(
  input: EnablePasskeyInput
) {

  const res =
    await query(
      `
      UPDATE wallet_security

      SET

        passkey_enabled = $2,

        updated_at = NOW()

      WHERE user_id = $1

      RETURNING *
      `,
      [

        input.user_id,

        input.enabled,

      ]
    );

  return res.rows[0]
    ? mapWalletSecurity(
        res.rows[0]
      )
    : null;

}
