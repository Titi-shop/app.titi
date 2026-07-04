// =====================================================
// lib/services/wallet-security.service.ts
// =====================================================

import {
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import {

  getWalletSecurityByUserId,
  hasWalletPin,

  createWalletSecurity,
  setWalletPin,
  changeWalletPin,

  markWalletPinVerified,

  incrementWalletFailedAttempts,
  resetWalletFailedAttempts,
  lockWalletSecurity,
  unlockWalletSecurity,

} from "@/lib/db/wallet-security";

/* =====================================================
   TYPES
===================================================== */

type SetupWalletPinInput = {

  userId: string;

  pin: string;

};

type VerifyWalletPinInput = {
  userId: string;
  pin: string;

};

type ChangeWalletPinInput = {

  userId: string;
  currentPin: string;
  newPin: string;

};

type VerifyWalletPinResult = {

  success: boolean;
  locked: boolean;
  remainingAttempts: number;

};

/* =====================================================
   CONSTANTS
===================================================== */

const MAX_FAILED_ATTEMPTS =
  5;

const LOCK_MINUTES =
  15;

const PIN_LENGTH =
  6;

/* =====================================================
   LOG
===================================================== */

function log(
  tag: string,
  data?: unknown
) {

  console.log(
    `[WALLET_SECURITY] ${tag}`,
    data ?? ""
  );

}

function err(
  tag: string,
  data?: unknown
) {

  console.error(
    `[WALLET_SECURITY] ${tag}`,
    data ?? ""
  );

}

/* =====================================================
   HELPERS
===================================================== */

function validatePin(
  pin: string
) {

  return /^\d{6}$/.test(
    pin
  );

}

function createSalt() {

  return randomUUID();

}

function hashPin(
  pin: string,
  salt: string
) {

  return scryptSync(
    pin,
    salt,
    64
  ).toString(
    "hex"
  );

}

function encodeHash(
  salt: string,
  hash: string
) {

  return `${salt}:${hash}`;

}

function decodeHash(
  value: string
) {

  const [
    salt,
    hash,
  ] =
    value.split(
      ":"
    );

  return {

    salt,

    hash,

  };

}

function verifyHash(
  pin: string,
  encoded: string
) {

  const {

    salt,

    hash,

  } =
    decodeHash(
      encoded
    );

  const calculated =
    hashPin(
      pin,
      salt
    );

  return timingSafeEqual(

    Buffer.from(
      calculated,
      "hex"
    ),

    Buffer.from(
      hash,
      "hex"
    )

  );

}
/* =====================================================
   GET SECURITY
===================================================== */

export async function getWalletSecurity(
  userId: string
) {

  log(
    "GET_SECURITY_START",
    {
      userId,
    }
  );

  const security =
    await getWalletSecurityByUserId(
      userId
    );

  log(
    "GET_SECURITY_DONE",
    {
      found:
        !!security,
    }
  );

  return security;

}

/* =====================================================
   HAS PIN
===================================================== */

export async function hasWalletPinFlow(
  userId: string
) {

  log(
    "HAS_PIN_START",
    {
      userId,
    }
  );

  const enabled =
    await hasWalletPin(
      userId
    );

  log(
    "HAS_PIN_DONE",
    {
      enabled,
    }
  );

  return enabled;

}

/* =====================================================
   CREATE SECURITY IF NOT EXISTS
===================================================== */

async function ensureWalletSecurity(
  userId: string
) {

  log(
    "ENSURE_SECURITY_START",
    {
      userId,
    }
  );

  let security =
    await getWalletSecurityByUserId(
      userId
    );

  if (
    security
  ) {

    log(
      "SECURITY_EXISTS",
      {
        id:
          security.id,
      }
    );

    return security;

  }

  log(
    "SECURITY_CREATE_START",
    {
      userId,
    }
  );

  security =
    await createWalletSecurity({

      user_id:
        userId,

      created_by:
        userId,

    });

  log(
    "SECURITY_CREATE_DONE",
    {
      id:
        security.id,
    }
  );

  return security;

}
/* =====================================================
   SETUP PIN
===================================================== */

export async function setupWalletPin(
  input: SetupWalletPinInput
) {

  log(
    "SETUP_PIN_START",
    {
      userId:
        input.userId,
    }
  );

  if (
    !validatePin(
      input.pin
    )
  ) {

    err(
      "INVALID_PIN_FORMAT"
    );

    throw new Error(
      "INVALID_PIN"
    );

  }

  const security =
    await ensureWalletSecurity(
      input.userId
    );

  if (
    security.pin_enabled
  ) {

    err(
      "PIN_ALREADY_EXISTS",
      {
        userId:
          input.userId,
      }
    );

    throw new Error(
      "PIN_ALREADY_EXISTS"
    );

  }

  log(
    "PIN_HASH_START"
  );

  const salt =
    createSalt();

  const hash =
    hashPin(
      input.pin,
      salt
    );

  const encoded =
    encodeHash(
      salt,
      hash
    );

  log(
    "PIN_HASH_DONE"
  );

  log(
    "DB_SAVE_PIN_START"
  );

  const updated =
    await setWalletPin(

      input.userId,

      encoded

    );

  if (!updated) {

  err(
    "DB_SAVE_PIN_FAILED"
  );

  throw new Error(
    "PIN_SAVE_FAILED"
  );

}

log(
  "DB_SAVE_PIN_DONE",
  {

    pinEnabled:
      updated.pin_enabled,

    hasHash:
      !!updated.pin_hash,

  }
);

  log(
    "SETUP_PIN_SUCCESS",
    {
      userId:
        input.userId,
    }
  );

  return updated;

}
/* =====================================================
   VERIFY PIN
===================================================== */

export async function verifyWalletPin(
  input: VerifyWalletPinInput
): Promise<VerifyWalletPinResult> {

  log(
    "VERIFY_PIN_START",
    {
      userId:
        input.userId,
    }
  );

  if (
    !validatePin(
      input.pin
    )
  ) {

    err(
      "INVALID_PIN_FORMAT"
    );

    throw new Error(
      "INVALID_PIN"
    );

  }

  const security =
    await getWalletSecurityByUserId(
      input.userId
    );

  if (
    !security
  ) {

    err(
      "SECURITY_NOT_FOUND"
    );

    throw new Error(
      "SECURITY_NOT_FOUND"
    );

  }

  if (
    !security.pin_enabled
  ) {

    err(
      "PIN_NOT_ENABLED"
    );

    throw new Error(
      "PIN_NOT_ENABLED"
    );

  }

  /* ===============================================
     CHECK LOCK
  =============================================== */

  if (
    security.locked_until &&
    new Date(
      security.locked_until
    ).getTime() >
      Date.now()
  ) {

    log(
      "PIN_LOCKED",
      {
        lockedUntil:
          security.locked_until,
      }
    );

    return {

      success:
        false,

      locked:
        true,

      remainingAttempts:
        0,

    };

  }

  /* ===============================================
     VERIFY HASH
  =============================================== */

  const matched =
    verifyHash(

      input.pin,

      security.pin_hash

    );

  if (
    matched
  ) {

    log(
      "PIN_MATCHED"
    );

    await resetWalletFailedAttempts(
      security.id
    );

    await unlockWalletSecurity(
      security.id
    );

    await markWalletPinVerified(
      security.id
    );

    log(
      "VERIFY_PIN_SUCCESS"
    );

    return {

      success:
        true,

      locked:
        false,

      remainingAttempts:
        MAX_FAILED_ATTEMPTS,

    };

  }

  /* ===============================================
     FAILED
  =============================================== */

  log(
    "PIN_INVALID"
  );

  const updated =
    await incrementWalletFailedAttempts(
      security.id
    );

  const attempts =
    updated.failed_attempts;

  const remaining =
    Math.max(
      0,
      MAX_FAILED_ATTEMPTS -
      attempts
    );

  if (
    attempts >=
    MAX_FAILED_ATTEMPTS
  ) {

    const lockedUntil =
      new Date(
        Date.now() +
        LOCK_MINUTES *
        60 *
        1000
      );

    await lockWalletSecurity(

      security.id,

      lockedUntil

    );

    log(
      "PIN_LOCKED",
      {
        attempts,
        lockedUntil,
      }
    );

    return {

      success:
        false,

      locked:
        true,

      remainingAttempts:
        0,

    };

  }

  log(
    "VERIFY_PIN_FAILED",
    {
      attempts,
      remaining,
    }
  );

  return {

    success:
      false,

    locked:
      false,

    remainingAttempts:
      remaining,

  };

}
/* =====================================================
   CHANGE PIN
===================================================== */

export async function changeWalletPinFlow(
  input: ChangeWalletPinInput
) {

  log(
    "CHANGE_PIN_START",
    {
      userId:
        input.userId,
    }
  );

  /* ===============================================
     VERIFY CURRENT PIN
  =============================================== */

  const verified =
    await verifyWalletPin({

      userId:
        input.userId,

      pin:
        input.currentPin,

    });

  if (
    !verified.success
  ) {

    err(
      "CURRENT_PIN_INVALID"
    );

    throw new Error(
      verified.locked
        ? "PIN_LOCKED"
        : "INVALID_PIN"
    );

  }

  /* ===============================================
     VALIDATE NEW PIN
  =============================================== */

  if (
    !validatePin(
      input.newPin
    )
  ) {

    err(
      "INVALID_NEW_PIN"
    );

    throw new Error(
      "INVALID_PIN"
    );

  }

  if (
    input.currentPin ===
    input.newPin
  ) {

    err(
      "PIN_NOT_CHANGED"
    );

    throw new Error(
      "PIN_NOT_CHANGED"
    );

  }

  /* ===============================================
     HASH NEW PIN
  =============================================== */

  log(
    "HASH_NEW_PIN_START"
  );

  const salt =
    createSalt();

  const hash =
    hashPin(
      input.newPin,
      salt
    );

  const encoded =
    encodeHash(
      salt,
      hash
    );

  log(
    "HASH_NEW_PIN_DONE"
  );

  /* ===============================================
     SAVE
  =============================================== */

  log(
    "DB_CHANGE_PIN_START"
  );

  const security =
  await changeWalletPin({

    user_id:
      input.userId,

    pin_hash:
      encoded,

    updated_by:
      input.userId,

  });
  log(
    "DB_CHANGE_PIN_DONE"
  );

  await resetWalletFailedAttempts(
    security.id
  );

  await unlockWalletSecurity(
    security.id
  );

  log(
    "CHANGE_PIN_SUCCESS",
    {
      userId:
        input.userId,
    }
  );

  return security;

}
/* =====================================================
   RESET PIN
===================================================== */

export async function resetWalletPinFlow(
  userId: string
) {

  log(
    "RESET_PIN_START",
    {
      userId,
    }
  );

  const security =
    await getWalletSecurityByUserId(
      userId
    );

  if (!security) {

    err(
      "SECURITY_NOT_FOUND"
    );

    throw new Error(
      "SECURITY_NOT_FOUND"
    );

  }

  await resetWalletFailedAttempts(
    security.id
  );

  await unlockWalletSecurity(
    security.id
  );

  log(
    "RESET_PIN_SUCCESS",
    {
      userId,
    }
  );

  return security;

}

/* =====================================================
   ENABLE TOTP
===================================================== */

export async function enableTotpFlow(
  userId: string
) {

  log(
    "ENABLE_TOTP_START",
    {
      userId,
    }
  );

  /**
   * TODO
   * Generate Secret
   * QR Code
   * Save Secret
   */

  log(
    "ENABLE_TOTP_PENDING"
  );

}

/* =====================================================
   DISABLE TOTP
===================================================== */

export async function disableTotpFlow(
  userId: string
) {

  log(
    "DISABLE_TOTP_START",
    {
      userId,
    }
  );

  /**
   * TODO
   */

  log(
    "DISABLE_TOTP_PENDING"
  );

}

/* =====================================================
   ENABLE BIOMETRIC
===================================================== */

export async function enableBiometricFlow(
  userId: string
) {

  log(
    "ENABLE_BIOMETRIC_START",
    {
      userId,
    }
  );

  /**
   * TODO
   * Face ID
   * Touch ID
   */

  log(
    "ENABLE_BIOMETRIC_PENDING"
  );

}

/* =====================================================
   DISABLE BIOMETRIC
===================================================== */

export async function disableBiometricFlow(
  userId: string
) {

  log(
    "DISABLE_BIOMETRIC_START",
    {
      userId,
    }
  );

  /**
   * TODO
   */

  log(
    "DISABLE_BIOMETRIC_PENDING"
  );

}

/* =====================================================
   ENABLE PASSKEY
===================================================== */

export async function enablePasskeyFlow(
  userId: string
) {

  log(
    "ENABLE_PASSKEY_START",
    {
      userId,
    }
  );

  /**
   * TODO
   * WebAuthn
   */

  log(
    "ENABLE_PASSKEY_PENDING"
  );

}

/* =====================================================
   DISABLE PASSKEY
===================================================== */

export async function disablePasskeyFlow(
  userId: string
) {

  log(
    "DISABLE_PASSKEY_START",
    {
      userId,
    }
  );

  /**
   * TODO
   */

  log(
    "DISABLE_PASSKEY_PENDING"
  );

}
