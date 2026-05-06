import { withTransaction } from "@/lib/db";
import { piGetPayment } from "@/lib/pi/client";
import crypto from "crypto";

/* =========================================================
   TYPES
========================================================= */

export type PiPaymentResponse = {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  from_address: string;
  to_address: string;
  status?: {
    developer_approved?: boolean;
    transaction_verified?: boolean;
    developer_completed?: boolean;
    cancelled?: boolean;
    user_cancelled?: boolean;
  };
  metadata?: Record<string, unknown>;
  transaction?: {
    txid?: string;
    verified?: boolean;
  };
};

type VerifyReconcileParams = {
  paymentIntentId: string;
  piPaymentId: string;
  userId: string;
  txid: string;
};

type VerifyReconcileResult = {
  ok: boolean;
  verifiedAmount: number;
  receiverWallet: string;
  piUid: string | null;
  piPayload: unknown;
};

/* =========================================================
   HELPERS
========================================================= */

function safeNumber(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("INVALID_NUMBER");
  return n;
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.00001;
}

/* =========================================================
   MAIN VERIFY (IDEMPOTENT + SAFE)
========================================================= */

export async function verifyPiPaymentForReconcile({
  paymentIntentId,
  piPaymentId,
  userId,
  txid,
}: VerifyReconcileParams): Promise<VerifyReconcileResult> {
  return withTransaction(async (client) => {
    console.log("[V6][RECON] START", {
      paymentIntentId,
      piPaymentId,
      txid,
    });

    /* =====================================================
       1. LOCK PAYMENT INTENT
    ===================================================== */

    const res = await client.query<{
      buyer_id: string;
      total_amount: string;
      merchant_wallet: string;
      pi_payment_id: string | null;
      pi_user_uid: string | null;
      pi_verified_amount: string | null;
    }>(
      `
      SELECT
        buyer_id,
        total_amount,
        merchant_wallet,
        pi_payment_id,
        pi_user_uid,
        pi_verified_amount
      FROM payment_intents
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentIntentId]
    );

    if (!res.rows.length) {
      throw new Error("PAYMENT_INTENT_NOT_FOUND");
    }

    const intent = res.rows[0];

    if (intent.buyer_id !== userId) {
      throw new Error("FORBIDDEN");
    }

    if (intent.pi_payment_id && intent.pi_payment_id !== piPaymentId) {
      throw new Error("PI_PAYMENT_ID_MISMATCH");
    }

    const expectedAmount = safeNumber(intent.total_amount);

    /* =====================================================
       2. IDEMPOTENCY CHECK (SAFE)
       -> NO SELECT BEFORE INSERT RACE CONDITION
    ===================================================== */

    const pi = await piGetPayment(piPaymentId);

    if (pi.status?.cancelled || pi.status?.user_cancelled) {
      throw new Error("PI_PAYMENT_CANCELLED");
    }

    if (!pi.status?.developer_approved) {
      throw new Error("PI_NOT_APPROVED");
    }

    const piAmount = safeNumber(pi.amount);

    if (!sameAmount(expectedAmount, piAmount)) {
      throw new Error("PI_AMOUNT_MISMATCH");
    }

    if (
      String(pi.to_address).trim() !==
      String(intent.merchant_wallet).trim()
    ) {
      throw new Error("PI_RECEIVER_MISMATCH");
    }

    if (pi.transaction?.txid && pi.transaction.txid !== txid) {
      throw new Error("PI_TXID_MISMATCH");
    }

    /* =====================================================
       3. UPSERT RECEIPT (ABSOLUTE SAFETY)
       -> eliminates duplicate key crash forever
    ===================================================== */

    const receipt = await client.query(
      `
      INSERT INTO payment_receipts (
        payment_intent_id,
        user_id,
        pi_payment_id,
        pi_uid,
        txid,
        expected_amount,
        verified_amount,
        receiver_wallet,
        verification_status,
        verify_source,
        pi_payload,
        verified_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,
        'pi_verified',
        'PI_SERVER',
        $9,
        now(),
        now(),
        now()
      )
      ON CONFLICT (pi_payment_id)
      DO UPDATE SET
        txid = EXCLUDED.txid,
        verified_amount = EXCLUDED.verified_amount,
        receiver_wallet = EXCLUDED.receiver_wallet,
        pi_payload = EXCLUDED.pi_payload,
        updated_at = now()
      RETURNING *
      `,
      [
        paymentIntentId,
        userId,
        piPaymentId,
        pi.user_uid || null,
        txid,
        expectedAmount,
        piAmount,
        pi.to_address,
        JSON.stringify(pi),
      ]
    );

    console.log("[V6][RECON] UPSERT_OK", {
      receiptId: receipt.rows[0]?.id,
    });

    /* =====================================================
       4. RETURN SAFE RESULT
    ===================================================== */

    return {
      ok: true,
      verifiedAmount: piAmount,
      receiverWallet: pi.to_address,
      piUid: pi.user_uid || null,
      piPayload: pi,
    };
  });
}
