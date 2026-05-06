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

function same(a: number, b: number) {
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
  console.log("[RECON][START]", { paymentIntentId, piPaymentId });

  /* =====================================================
     1. FETCH INTENT (NO LOCK)
  ===================================================== */

  return withTransaction(async (client) => {
    const rs = await client.query<{
      buyer_id: string;
      total_amount: string;
      merchant_wallet: string;
      pi_payment_id: string | null;
      pi_user_uid: string | null;
    }>(
      `
      SELECT
        buyer_id,
        total_amount,
        merchant_wallet,
        pi_payment_id,
        pi_user_uid
      FROM payment_intents
      WHERE id = $1
      `,
      [paymentIntentId]
    );

    if (!rs.rows.length) throw new Error("INTENT_NOT_FOUND");

    const intent = rs.rows[0];

    if (intent.buyer_id !== userId) {
      throw new Error("FORBIDDEN");
    }

    if (
      intent.pi_payment_id &&
      intent.pi_payment_id !== piPaymentId
    ) {
      throw new Error("PI_PAYMENT_ID_MISMATCH");
    }

    const expected = num(intent.total_amount);

    /* =====================================================
       2. CALL PI OUTSIDE DB LOCK
    ===================================================== */

    const pi = await piGetPayment(piPaymentId);

    if (pi.status?.cancelled || pi.status?.user_cancelled) {
      throw new Error("PI_CANCELLED");
    }

    if (!pi.status?.developer_approved) {
      throw new Error("PI_NOT_APPROVED");
    }

    const amount = num(pi.amount);

    if (!same(expected, amount)) {
      throw new Error("AMOUNT_MISMATCH");
    }

    if (
      String(pi.to_address).trim() !==
      String(intent.merchant_wallet).trim()
    ) {
      throw new Error("RECEIVER_MISMATCH");
    }

    if (pi.transaction?.txid && pi.transaction.txid !== txid) {
      throw new Error("TXID_MISMATCH");
    }

    /* =====================================================
       3. UPSERT RECEIPT (IDEMPOTENT SAFE)
    ===================================================== */

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
      `,
      [
        paymentIntentId,
        userId,
        piPaymentId,
        pi.user_uid ?? null,
        txid,
        expected,
        amount,
        pi.to_address,
        JSON.stringify(pi),
      ]
    );

    console.log("[RECON][OK]", paymentIntentId);

    return {
      ok: true,
      verifiedAmount: amount,
      receiverWallet: pi.to_address,
      piUid: pi.user_uid ?? null,
      piPayload: pi,
    };
  });
}
