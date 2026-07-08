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

import {
  logger,
  maskId,
} from "@/lib/logger";

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

const MAX_FAILED_ATTEMPTS = 5;

const LOCK_MINUTES = 15;

const PIN_LENGTH = 6;

/* =====================================================
   HELPERS
===================================================== */

function validatePin(
  pin: string
) {
  return /^\d{6}$/.test(pin);
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
  ).toString("hex");
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
  ] = value.split(":");

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
  } = decodeHash(encoded);

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

  logger.info(
    "WALLET_SECURITY.GET_START",
    {
      userId: maskId(userId),
    }
  );

  const security =
    await getWalletSecurityByUserId(
      userId
    );

  logger.info(
    "WALLET_SECURITY.GET_DONE",
    {
      userId: maskId(userId),
      found: !!security,
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

  logger.info(
    "WALLET_SECURITY.HAS_PIN_START",
    {
      userId: maskId(userId),
    }
  );

  const enabled =
    await hasWalletPin(
      userId
    );

  logger.info(
    "WALLET_SECURITY.HAS_PIN_DONE",
    {
      userId: maskId(userId),
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

  logger.debug(
    "WALLET_SECURITY.ENSURE_START",
    {
      userId: maskId(userId),
    }
  );

  let security =
    await getWalletSecurityByUserId(
      userId
    );

  if (security) {

    logger.debug(
      "WALLET_SECURITY.EXISTS",
      {
        securityId: maskId(
          security.id
        ),
      }
    );

    return security;

  }

  logger.debug(
    "WALLET_SECURITY.CREATE_START",
    {
      userId: maskId(userId),
    }
  );

  security =
    await createWalletSecurity({

      user_id:
        userId,

      created_by:
        userId,

    });

  logger.info(
    "WALLET_SECURITY.CREATE_SUCCESS",
    {
      securityId: maskId(
        security.id
      ),
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

  logger.info(
    "WALLET_SECURITY.SETUP_START",
    {
      userId: maskId(input.userId),
    }
  );

  if (
    !validatePin(input.pin)
  ) {

    logger.warn(
      "WALLET_SECURITY.INVALID_PIN",
      {
        userId: maskId(input.userId),
      }
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

    logger.warn(
      "WALLET_SECURITY.PIN_ALREADY_EXISTS",
      {
        userId: maskId(input.userId),
      }
    );

    throw new Error(
      "PIN_ALREADY_EXISTS"
    );

  }

  logger.debug(
    "WALLET_SECURITY.HASH_PIN"
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

  logger.debug(
    "WALLET_SECURITY.PIN_SAVE_START"
  );

  const updated =
    await setWalletPin({

      user_id:
        input.userId,

      pin_hash:
        encoded,

      updated_by:
        input.userId,

    });

  if (!updated) {

    logger.error(
      "WALLET_SECURITY.PIN_SAVE_FAILED",
      {
        userId: maskId(input.userId),
      }
    );

    throw new Error(
      "PIN_SAVE_FAILED"
    );

  }

  logger.info(
    "WALLET_SECURITY.PIN_CREATED",
    {
      userId: maskId(input.userId),
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

  logger.info(
    "WALLET_SECURITY.VERIFY_START",
    {
      userId: maskId(input.userId),
    }
  );

  if (
    !validatePin(input.pin)
  ) {

    logger.warn(
      "WALLET_SECURITY.INVALID_PIN",
      {
        userId: maskId(input.userId),
      }
    );

    throw new Error(
      "INVALID_PIN"
    );

  }

  const security =
    await getWalletSecurityByUserId(
      input.userId
    );

  if (!security) {

    logger.error(
      "WALLET_SECURITY.SECURITY_NOT_FOUND",
      {
        userId: maskId(input.userId),
      }
    );

    throw new Error(
      "SECURITY_NOT_FOUND"
    );

  }

  if (
    !security.pin_enabled
  ) {

    logger.warn(
      "WALLET_SECURITY.PIN_NOT_ENABLED",
      {
        userId: maskId(input.userId),
      }
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

    logger.warn(
      "WALLET_SECURITY.PIN_LOCKED",
      {
        userId: maskId(input.userId),
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

  if (matched) {

    await resetWalletFailedAttempts(
      security.id
    );

    await unlockWalletSecurity(
      security.id
    );

    await markWalletPinVerified(
      security.id
    );

    logger.info(
      "WALLET_SECURITY.VERIFIED",
      {
        userId: maskId(input.userId),
      }
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

    logger.warn(
      "WALLET_SECURITY.PIN_LOCKED",
      {
        userId: maskId(input.userId),
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

  logger.warn(
    "WALLET_SECURITY.PIN_INVALID",
    {
      userId: maskId(input.userId),
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

  logger.info(
    "WALLET_SECURITY.CHANGE_START",
    {
      userId: maskId(input.userId),
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

  if (!verified.success) {

    logger.warn(
      "WALLET_SECURITY.CURRENT_PIN_INVALID",
      {
        userId: maskId(input.userId),
      }
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

    logger.warn(
      "WALLET_SECURITY.INVALID_NEW_PIN",
      {
        userId: maskId(input.userId),
      }
    );

    throw new Error(
      "INVALID_PIN"
    );

  }

  if (
    input.currentPin ===
    input.newPin
  ) {

    logger.warn(
      "WALLET_SECURITY.PIN_NOT_CHANGED",
      {
        userId: maskId(input.userId),
      }
    );

    throw new Error(
      "PIN_NOT_CHANGED"
    );

  }

  /* ===============================================
     HASH NEW PIN
  =============================================== */

  logger.debug(
    "WALLET_SECURITY.HASH_NEW_PIN"
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

  /* ===============================================
     SAVE
  =============================================== */

  logger.debug(
    "WALLET_SECURITY.PIN_UPDATE_START"
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

  await resetWalletFailedAttempts(
    security.id
  );

  await unlockWalletSecurity(
    security.id
  );

  logger.info(
    "WALLET_SECURITY.CHANGE_SUCCESS",
    {
      userId: maskId(input.userId),
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

  logger.info(
    "WALLET_SECURITY.RESET_START",
    {
      userId: maskId(userId),
    }
  );

  const security =
    await getWalletSecurityByUserId(
      userId
    );

  if (!security) {

    logger.error(
      "WALLET_SECURITY.SECURITY_NOT_FOUND",
      {
        userId: maskId(userId),
      }
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

  logger.info(
    "WALLET_SECURITY.RESET_SUCCESS",
    {
      userId: maskId(userId),
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

  logger.info(
    "WALLET_SECURITY.TOTP_ENABLE_START",
    {
      userId: maskId(userId),
    }
  );

  /**
   * TODO
   * Generate Secret
   * QR Code
   * Save Secret
   */

  logger.debug(
    "WALLET_SECURITY.TOTP_ENABLE_PENDING"
  );

}

/* =====================================================
   DISABLE TOTP
===================================================== */

export async function disableTotpFlow(
  userId: string
) {

  logger.info(
    "WALLET_SECURITY.TOTP_DISABLE_START",
    {
      userId: maskId(userId),
    }
  );

  /**
   * TODO
   */

  logger.debug(
    "WALLET_SECURITY.TOTP_DISABLE_PENDING"
  );

}

/* =====================================================
   ENABLE BIOMETRIC
===================================================== */

export async function enableBiometricFlow(
  userId: string
) {

  logger.info(
    "WALLET_SECURITY.BIOMETRIC_ENABLE_START",
    {
      userId: maskId(userId),
    }
  );

  /**
   * TODO
   * Face ID
   * Touch ID
   */

  logger.debug(
    "WALLET_SECURITY.BIOMETRIC_ENABLE_PENDING"
  );

}

/* =====================================================
   DISABLE BIOMETRIC
===================================================== */

export async function disableBiometricFlow(
  userId: string
) {

  logger.info(
    "WALLET_SECURITY.BIOMETRIC_DISABLE_START",
    {
      userId: maskId(userId),
    }
  );

  /**
   * TODO
   */

  logger.debug(
    "WALLET_SECURITY.BIOMETRIC_DISABLE_PENDING"
  );

}

/* =====================================================
   ENABLE PASSKEY
===================================================== */

export async function enablePasskeyFlow(
  userId: string
) {

  logger.info(
    "WALLET_SECURITY.PASSKEY_ENABLE_START",
    {
      userId: maskId(userId),
    }
  );

  /**
   * TODO
   * WebAuthn
   */

  logger.debug(
    "WALLET_SECURITY.PASSKEY_ENABLE_PENDING"
  );

}

/* =====================================================
   DISABLE PASSKEY
===================================================== */

export async function disablePasskeyFlow(
  userId: string
) {

  logger.info(
    "WALLET_SECURITY.PASSKEY_DISABLE_START",
    {
      userId: maskId(userId),
    }
  );

  /**
   * TODO
   */

  logger.debug(
    "WALLET_SECURITY.PASSKEY_DISABLE_PENDING"
  );

}
