import { withTransaction } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

type BindParams = {
  userId: string;
  paymentIntentId: string;
  piPaymentId: string;
  piUid: string;
  verifiedAmount: number;
  piPayload: unknown;
};

/* =========================================================
   VALIDATION HELPERS
========================================================= */

function isUUID(v: string): boolean {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

function safeNumber(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("INVALID_AMOUNT");
  return n;
}

/* =========================================================
   MAIN BIND FUNCTION
========================================================= */

export async function bindPiPaymentToIntent(
  params: BindParams
): Promise<void> {
  return withTransaction(async (client) => {
    const {
      userId,
      paymentIntentId,
      piPaymentId,
      piUid,
      verifiedAmount,
      piPayload,
    } = params;

    console.log("[PAYMENT][BIND] START", {
      paymentIntentId,
      piPaymentId,
      userId,
    });

    /* =====================================================
       0. VALIDATION (FAST FAIL)
    ===================================================== */

    if (!isUUID(paymentIntentId) || !isUUID(userId)) {
      console.error("[PAYMENT][BIND] INVALID_UUID");
      throw new Error("INVALID_UUID");
    }

    if (!piUid) {
      console.error("[PAYMENT][BIND] PI_UID_MISSING");
      throw new Error("PI_UID_NOT_PROVIDED");
    }

    const amount = safeNumber(verifiedAmount);

    /* =====================================================
       1. PRECHECK (NO LOCK)
    ===================================================== */

    const pre = await client.query<{
      id: string;
      buyer_id: string;
      status: string;
      pi_payment_id: string | null;
    }>(
      `
      SELECT id, buyer_id, status, pi_payment_id
      FROM payment_intents
      WHERE id = $1
      `,
      [paymentIntentId]
    );

    if (!pre.rows.length) {
      console.error("[PAYMENT][BIND] INTENT_NOT_FOUND");
      throw new Error("PAYMENT_INTENT_NOT_FOUND");
    }

    const intent = pre.rows[0];

    if (intent.buyer_id !== userId) {
      console.error("[PAYMENT][BIND] FORBIDDEN");
      throw new Error("FORBIDDEN");
    }

    if (intent.status === "paid") {
      console.log("[PAYMENT][BIND] ALREADY_PAID_SKIP");
      return;
    }

    if (
      intent.pi_payment_id &&
      intent.pi_payment_id !== piPaymentId
    ) {
      console.error("[PAYMENT][BIND] ALREADY_BOUND");
      throw new Error("PI_PAYMENT_ALREADY_BOUND");
    }

    /* =====================================================
       2. LOCK (MINIMAL CRITICAL SECTION)
    ===================================================== */

    console.log("[PAYMENT][BIND] LOCKING");

    const lock = await client.query(
      `
      SELECT id
      FROM payment_intents
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentIntentId]
    );

    if (!lock.rows.length) {
      console.error("[PAYMENT][BIND] LOCK_FAILED");
      throw new Error("LOCK_FAILED");
    }

    /* =====================================================
       3. UPDATE (ATOMIC)
    ===================================================== */

    console.log("[PAYMENT][BIND] UPDATING");

    await client.query(
      `
      UPDATE payment_intents
      SET
        pi_payment_id = $2,
        pi_user_uid = $3,
        pi_verified_amount = $4,
        pi_payment_payload = $5,
        status = 'submitted',
        updated_at = now()
      WHERE id = $1
        AND buyer_id = $6
      `,
      [
        paymentIntentId,
        piPaymentId,
        piUid,
        amount,
        JSON.stringify(piPayload ?? {}),
        userId,
      ]
    );

    console.log("[PAYMENT][BIND] SUCCESS", {
      paymentIntentId,
      piPaymentId,
    });
  });
}
