
import { withTransaction } from "@/lib/db";
import { randomUUID } from "crypto";

/* =========================================================
   TYPES
========================================================= */

type MarkPaymentVerifyingInput = {
  paymentIntentId: string;
  userId: string;
  piPaymentId: string;
  txid: string;
};

type PaymentIntentRow = {
  id: string;
  buyer_id: string;
  status: string;
  pi_user_uid: string | null;
  pi_payment_id: string | null;
  merchant_wallet: string;
  total_amount: string;
  currency: string;
};

/* =========================================================
   MAIN
========================================================= */

export async function markPaymentVerifying({
  paymentIntentId,
  userId,
  piPaymentId,
  txid,
}: MarkPaymentVerifyingInput): Promise<{
  ok: true;
  already: boolean;
  status: string;
  paymentIntentId: string;
}> {
  return withTransaction(async (client) => {
    console.log("[PAYMENT][SUBMIT] START", {
      paymentIntentId,
      userId,
      piPaymentId,
    });

    /* =====================================================
       1. LOCK INTENT
    ===================================================== */

    const rs = await client.query<PaymentIntentRow>(
      `
      SELECT
        id,
        buyer_id,
        status,
        pi_user_uid,
        pi_payment_id,
        merchant_wallet,
        total_amount,
        currency
      FROM payment_intents
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentIntentId]
    );

    if (!rs.rows.length) {
      throw new Error("INTENT_NOT_FOUND");
    }

    const intent = rs.rows[0];

    if (intent.buyer_id !== userId) {
      throw new Error("FORBIDDEN");
    }

    console.log("[PAYMENT][SUBMIT] INTENT_OK", {
      status: intent.status,
    });

    /* =====================================================
       2. IDEMPOTENT RETURN
    ===================================================== */

    if (intent.status === "paid") {
      return {
        ok: true,
        already: true,
        status: "paid",
        paymentIntentId,
      };
    }

    if (intent.status === "verifying") {
      return {
        ok: true,
        already: true,
        status: "verifying",
        paymentIntentId,
      };
    }

    /* =====================================================
       3. STATUS CHECK (FIXED)
       - allow authorized INCLUDED
===================================================== */

    const allowedStatus = ["created", "wallet_opened", "authorized"];

    if (!allowedStatus.includes(intent.status)) {
      throw new Error("INVALID_STATUS");
    }

    /* =====================================================
       4. PI UID (FIX CRITICAL BUG)
===================================================== */

    const piUid = intent.pi_user_uid;

    if (!piUid || typeof piUid !== "string") {
      throw new Error("PI_UID_NOT_BOUND");
    }

    /* =====================================================
       5. REPLAY PROTECTION
===================================================== */

    const dup = await client.query(
      `
      SELECT id
      FROM payment_intents
      WHERE (pi_payment_id = $1 OR txid = $2)
        AND id <> $3
      LIMIT 1
      `,
      [piPaymentId, txid, paymentIntentId]
    );

    if (dup.rows.length) {
      throw new Error("REPLAY_DETECTED");
    }

    /* =====================================================
       6. GENERATE SAFE EVENT HASH
===================================================== */

    const eventHash = randomUUID();

    /* =====================================================
       7. UPDATE STATE → VERIFYING
===================================================== */

    await client.query(
      `
      UPDATE payment_intents
      SET
        status = 'verifying',
        settlement_state = 'UNSETTLED',
        pi_payment_id = $2,
        txid = $3,
        reconcile_attempts = reconcile_attempts + 1,
        last_reconcile_at = now(),
        settlement_lock_id = gen_random_uuid(),
        settlement_locked_at = now(),
        settlement_lock_source = 'submit_service',
        updated_at = now()
      WHERE id = $1
      `,
      [paymentIntentId, piPaymentId, txid]
    );

    console.log("[PAYMENT][SUBMIT] VERIFIED");

    return {
      ok: true,
      already: false,
      status: "verifying",
      paymentIntentId,
    };
  });
}
