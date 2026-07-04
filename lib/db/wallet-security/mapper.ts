// =====================================================
// lib/db/wallet-security/mapper.ts
// =====================================================

import type {
  WalletSecurity,
} from "./types";

/* =====================================================
   MAP
===================================================== */

export function mapWalletSecurity(
  row: Record<
    string,
    unknown
  >
): WalletSecurity {

  return {

    id:
      String(
        row.id
      ),

    user_id:
      String(
        row.user_id
      ),

    /* =================================================
       PIN
    ================================================= */

    pin_hash:
      row.pin_hash
        ? String(
            row.pin_hash
          )
        : null,

    pin_enabled:
      Boolean(
        row.pin_enabled
      ),

    pin_created_at:
      row.pin_created_at
        ? new Date(
            String(
              row.pin_created_at
            )
          )
        : null,

    pin_changed_at:
      row.pin_changed_at
        ? new Date(
            String(
              row.pin_changed_at
            )
          )
        : null,

    /* =================================================
       LOCK
    ================================================= */

    failed_attempts:
      Number(
        row.failed_attempts ?? 0
      ),

    locked_until:
      row.locked_until
        ? new Date(
            String(
              row.locked_until
            )
          )
        : null,

    last_verified_at:
      row.last_verified_at
        ? new Date(
            String(
              row.last_verified_at
            )
          )
        : null,

    /* =================================================
       GOOGLE AUTHENTICATOR
    ================================================= */

    totp_enabled:
      Boolean(
        row.totp_enabled
      ),

    totp_secret:
      row.totp_secret
        ? String(
            row.totp_secret
          )
        : null,

    totp_created_at:
      row.totp_created_at
        ? new Date(
            String(
              row.totp_created_at
            )
          )
        : null,

    /* =================================================
       PASSKEY
    ================================================= */

    passkey_enabled:
      Boolean(
        row.passkey_enabled
      ),

    /* =================================================
       BIOMETRIC
    ================================================= */

    biometric_enabled:
      Boolean(
        row.biometric_enabled
      ),

    /* =================================================
       RECOVERY
    ================================================= */

    recovery_code_hash:
      row.recovery_code_hash
        ? String(
            row.recovery_code_hash
          )
        : null,

    recovery_generated_at:
      row.recovery_generated_at
        ? new Date(
            String(
              row.recovery_generated_at
            )
          )
        : null,

    /* =================================================
       AUDIT
    ================================================= */

    created_at:
      new Date(
        String(
          row.created_at
        )
      ),

    updated_at:
      new Date(
        String(
          row.updated_at
        )
      ),

    created_by:
      row.created_by
        ? String(
            row.created_by
          )
        : null,

    updated_by:
      row.updated_by
        ? String(
            row.updated_by
          )
        : null,

  };

}
