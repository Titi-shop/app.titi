import { query } from "@/lib/db";

type PaymentStatus =
  | "initiated"
  | "authorized"
  | "verifying"
  | "paid"
  | "failed"
  | "cancelled";

type GuardInput = {
  paymentIntentId: string;
  userId: string;
};

type GuardResult =
  | {
      ok: true;
      status: PaymentStatus;
      amount: number;
      alreadyPaid: boolean;
      piPaymentId: string | null;
      txid: string | null;
    }
  | {
      ok: false;
      code:
        | "PAYMENT_NOT_FOUND"
        | "PAYMENT_FORBIDDEN"
        | "PAYMENT_CANCELLED"
        | "PAYMENT_FAILED"
        | "PAYMENT_ALREADY_PAID";
    };

type LockResult =
  | { ok: true }
  | { ok: false; code: "LOCK_DENIED" };

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

/* =========================================================
   LOAD PAYMENT INTENT STATE
========================================================= */

export async function guardPaymentForReconcile({
  paymentIntentId,
  userId,
}: GuardInput): Promise<GuardResult> {
  if (!isUUID(paymentIntentId) || !isUUID(userId)) {
    return { ok: false, code: "PAYMENT_NOT_FOUND" };
  }

  const rs = await query<{
    buyer_id: string;
    status: PaymentStatus;
    total_amount_pi: string;
    pi_payment_id: string | null;
    txid: string | null;
  }>(
    `
    SELECT
      buyer_id,
      status,
      total_amount_pi,
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

  if (row.buyer_id !== userId) {
    return { ok: false, code: "PAYMENT_FORBIDDEN" };
  }

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
    amount: Number(row.total_amount_pi),
    alreadyPaid: false,
    piPaymentId: row.pi_payment_id,
    txid: row.txid,
  };
}

/* =========================================================
   SETTLEMENT LOCK
   only one reconcile process can continue
========================================================= */

export async function acquirePaymentSettlementLock(
  paymentIntentId: string
): Promise<LockResult> {
  if (!isUUID(paymentIntentId)) {
    return { ok: false, code: "LOCK_DENIED" };
  }

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
