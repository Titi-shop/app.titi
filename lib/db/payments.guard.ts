import crypto from "crypto";
import { query } from "@/lib/db";
import type {
  GuardPaymentResult,
  PaymentLockResult,
} from "@/lib/payments/payment.types";

/* =========================================================
   TYPES
========================================================= */

type PaymentStatus =
  | "created"
  | "wallet_opened"
  | "submitted"
  | "verifying"
  | "paid"
  | "failed"
  | "cancelled";

type GuardInput = {
  paymentIntentId: string;
  userId: string | null;
  systemMode?: boolean;
};

type PaymentIntentGuardRow = {
  id: string;
  buyer_id: string;
  status: PaymentStatus;
  total_amount: string;
  pi_payment_id: string | null;
  txid: string | null;

  settlement_lock_id: string | null;
  settlement_locked_at: string | null;
  settlement_state: string | null;
};

/* =========================================================
   HELPERS
========================================================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function lockExpired(lockedAt: string | null): boolean {
  if (!lockedAt) return true;
  const diff = Date.now() - new Date(lockedAt).getTime();
  return diff > 1000 * 60 * 10; // 10 phút stale lock
}

/* =========================================================
   MAIN GUARD
========================================================= */

export async function guardPaymentForReconcile({
  paymentIntentId,
  userId,
  systemMode = false,
}: GuardInput): Promise<GuardPaymentResult> {
  if (!isUUID(paymentIntentId)) {
    return { ok: false, code: "PAYMENT_NOT_FOUND" };
  }

  const rs = await query<PaymentIntentGuardRow>(
    `
    SELECT
      id,
      buyer_id,
      status,
      total_amount,
      pi_payment_id,
      txid,
      settlement_lock_id,
      settlement_locked_at,
      settlement_state
    FROM payment_intents
    WHERE id = $1
    LIMIT 1
    `,
    [paymentIntentId]
  );

  if (!rs.rows.length) {
    return { ok: false, code: "PAYMENT_NOT_FOUND" };
  }

  const row = rs.rows[0];

  /* =========================================
     OWNERSHIP CHECK
  ========================================= */

  if (!systemMode) {
    if (!userId || !isUUID(userId) || row.buyer_id !== userId) {
      return { ok: false, code: "PAYMENT_FORBIDDEN" };
    }
  }

  /* =========================================
     HARD STATUS BLOCK
  ========================================= */

  if (row.status === "cancelled") {
    return { ok: false, code: "PAYMENT_CANCELLED" };
  }

  if (row.status === "failed") {
    return { ok: false, code: "PAYMENT_FAILED" };
  }

  if (row.status === "paid") {
    const order = await query<{ id: string }>(
      `
      SELECT id
      FROM orders
      WHERE pi_payment_id = $1
      LIMIT 1
      `,
      [row.pi_payment_id]
    );

    return {
      ok: false,
      code: "PAYMENT_ALREADY_PAID",
      orderId: order.rows[0]?.id ?? null,
      amount: Number(row.total_amount),
    };
  }

  /* =========================================
     LOCK STALE CHECK
  ========================================= */

  if (row.status === "verifying") {
  const currentRequestLockId = undefined; 
  const isSameRequest =
    row.settlement_lock_id === currentRequestLockId;

  if (!isSameRequest) {
    return { ok: false, code: "PAYMENT_LOCKED" };
  }
}

  return {
    ok: true,
    status: row.status,
    amount: Number(row.total_amount),
    piPaymentId: row.pi_payment_id,
    txid: row.txid,
  };
}

/* =========================================================
   ACQUIRE SINGLE FORENSIC LOCK
========================================================= */

export async function acquirePaymentSettlementLock(
  paymentIntentId: string
): Promise<PaymentLockResult> {
  if (!isUUID(paymentIntentId)) {
    return { ok: false, code: "LOCK_DENIED" };
  }

  const settlementLockId = crypto.randomUUID();

  const rs = await query<{ id: string }>(
    `
    UPDATE payment_intents
    SET
      status = 'verifying',
      settlement_lock_id = $2,
      settlement_locked_at = now(),
      settlement_lock_source = 'ORCHESTRATOR',
      settlement_state = 'LOCKED',
      updated_at = now()
    WHERE id = $1
      AND (
        status IN ('created','wallet_opened','submitted','verifying')
      )
      AND (
        settlement_lock_id IS NULL
        OR settlement_locked_at IS NULL
        OR settlement_locked_at < now() - interval '10 minutes'
      )
    RETURNING id
    `,
    [paymentIntentId, settlementLockId]
  );

  if (!rs.rows.length) {
    return { ok: false, code: "LOCK_DENIED" };
  }

  return {
    ok: true,
    lockId: settlementLockId,
  };
}

/* =========================================================
   RELEASE LOCK OPTIONAL
========================================================= */

export async function releasePaymentSettlementLock(
  paymentIntentId: string
): Promise<void> {
  if (!isUUID(paymentIntentId)) return;

  await query(
    `
    UPDATE payment_intents
    SET
      settlement_lock_id = NULL,
      settlement_locked_at = NULL,
      settlement_lock_source = NULL,
      updated_at = now()
    WHERE id = $1
      AND status <> 'paid'
    `,
    [paymentIntentId]
  );
}
