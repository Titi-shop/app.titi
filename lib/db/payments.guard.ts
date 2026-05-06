
import { query } from "@/lib/db";
import type {
  GuardPaymentResult,
  PaymentLockResult,
} from "@/lib/payments/payment.types";

type PaymentStatus =
  | "initiated"
  | "authorized"
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
  buyer_id: string;
  status: PaymentStatus;
  total_amount: string;
  pi_payment_id: string | null;
  txid: string | null;
};

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

/* =========================================================
   MAIN GUARD (READ ONLY - SAFE)
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
      buyer_id,
      status,
      total_amount,
      pi_payment_id,
      txid
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
     OWNER CHECK
  ========================================= */

  if (!systemMode) {
    if (!userId || !isUUID(userId) || row.buyer_id !== userId) {
      return { ok: false, code: "PAYMENT_FORBIDDEN" };
    }
  }

  /* =========================================
     BLOCK STATES
  ========================================= */

  if (row.status === "cancelled") {
    return { ok: false, code: "PAYMENT_CANCELLED" };
  }

  if (row.status === "failed") {
    return { ok: false, code: "PAYMENT_FAILED" };
  }

  if (row.status === "paid") {
    return { ok: false, code: "PAYMENT_ALREADY_PAID" };
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
   SETTLEMENT LOCK (FIXED - NO STATUS WRITE HERE)
========================================================= */

export async function acquirePaymentSettlementLock(
  paymentIntentId: string
): Promise<PaymentLockResult> {
  if (!isUUID(paymentIntentId)) {
    return { ok: false, code: "LOCK_DENIED" };
  }

  /**
   * ❌ OLD: UPDATE status = 'verifying' (CAUSE LOCK CHAINS)
   *
   * ✅ NEW: only atomic lock attempt, no status mutation
   */

  const rs = await query<{ id: string }>(
    `
    UPDATE payment_intents
    SET updated_at = now()
    WHERE id = $1
      AND status IN ('authorized','verifying')
    RETURNING id
    `,
    [paymentIntentId]
  );

  if (!rs.rows.length) {
    return { ok: false, code: "LOCK_DENIED" };
  }

  return { ok: true };
}
