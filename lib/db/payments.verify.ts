import { withTransaction } from "@/lib/db";
import { piGetPayment } from "@/lib/pi/client";

/* =========================================================
   TYPES
========================================================= */

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

function num(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("INVALID_NUMBER");
  return n;
}

function eq(a: number, b: number) {
  return Math.abs(a - b) < 0.00001;
}

/* =========================================================
   MAIN
========================================================= */

export async function verifyPiPaymentForReconcile({
  paymentIntentId,
  piPaymentId,
  userId,
  txid,
}: VerifyReconcileParams): Promise<VerifyReconcileResult> {
  /**
   * PHASE 1: FAST LOCK ONLY (NO EXTERNAL CALL)
   */
  const intent = await withTransaction(async (client) => {
    const res = await client.query<{
      buyer_id: string;
      total_amount: string;
      merchant_wallet: string;
      pi_payment_id: string | null;
      pi_user_uid: string | null;
    }>(
      `
      SELECT buyer_id, total_amount, merchant_wallet, pi_payment_id, pi_user_uid
      FROM payment_intents
      WHERE id = $1
      FOR UPDATE SKIP LOCKED
      `,
      [paymentIntentId]
    );

    if (!res.rows.length) throw new Error("PAYMENT_INTENT_NOT_FOUND");

    const row = res.rows[0];

    if (row.buyer_id !== userId) throw new Error("FORBIDDEN");

    if (row.pi_payment_id && row.pi_payment_id !== piPaymentId) {
      throw new Error("PI_PAYMENT_ID_MISMATCH");
    }

    return row;
  });

  /**
   * PHASE 2: CALL PI OUTSIDE TRANSACTION (IMPORTANT FIX)
   */
  const pi = await piGetPayment(piPaymentId);

  if (pi.status?.cancelled || pi.status?.user_cancelled) {
    throw new Error("PI_PAYMENT_CANCELLED");
  }

  if (!pi.status?.developer_approved) {
    throw new Error("PI_NOT_APPROVED");
  }

  const expected = num(intent.total_amount);
  const actual = num(pi.amount);

  if (!eq(expected, actual)) {
    throw new Error("PI_AMOUNT_MISMATCH");
  }

  if (String(pi.to_address).trim() !== String(intent.merchant_wallet).trim()) {
    throw new Error("PI_RECEIVER_MISMATCH");
  }

  if (pi.transaction?.txid && pi.transaction.txid !== txid) {
    throw new Error("PI_TXID_MISMATCH");
  }

  /**
   * PHASE 3: UPSERT (NO LOCK CONFLICT EVER)
   */
  await withTransaction(async (client) => {
    await client.query(
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
        now()
      )
      ON CONFLICT (pi_payment_id)
      DO UPDATE SET
        txid = EXCLUDED.txid,
        verified_amount = EXCLUDED.verified_amount,
        updated_at = now()
      `,
      [
        paymentIntentId,
        userId,
        piPaymentId,
        pi.user_uid || null,
        txid,
        expected,
        actual,
        pi.to_address,
        JSON.stringify(pi),
      ]
    );
  });

  return {
    ok: true,
    verifiedAmount: actual,
    receiverWallet: pi.to_address,
    piUid: pi.user_uid || null,
    piPayload: pi,
  };
}
