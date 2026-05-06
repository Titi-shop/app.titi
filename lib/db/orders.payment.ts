import { withTransaction } from "@/lib/db";
import crypto from "crypto";
import { SettlementLedgerV3 } from "@/lib/db/settlement.ledger";
import {
  auditPiVerified,
  auditRpcVerified,
  auditFinalizeDone,
  auditManualReview,
} from "@/lib/db/payments.audit";

/* =========================================================
   TYPES
========================================================= */

type FinalizePaidOrderParams = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
  verifiedAmount: number;
  receiverWallet: string;
  piUid?: string | null;
  piPayload: unknown;
  rpcPayload: unknown;
};

type PaymentIntentRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;

  unit_price: string;
  subtotal: string;
  discount: string;
  shipping_fee: string;
  total_amount: string;
  currency: string;

  shipping_snapshot: any;

  country: string;
  zone: string;

  merchant_wallet: string;

  status: string;
  settlement_state: string;

  pi_payment_id: string | null;
  txid: string | null;
};

/* =========================================================
   HELPERS
========================================================= */

function toNumber(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("INVALID_NUMBER");
  return n;
}

function isSameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.00001;
}

/* =========================================================
   CORE
========================================================= */

export async function finalizePaidOrderFromIntent({
  paymentIntentId,
  piPaymentId,
  txid,
  verifiedAmount,
  receiverWallet,
  piUid,
  piPayload,
  rpcPayload,
}: FinalizePaidOrderParams) {
  return withTransaction(async (client) => {
    /* =====================================================
       1. LOCK INTENT
    ===================================================== */

    const res = await client.query<PaymentIntentRow>(
      `SELECT * FROM payment_intents WHERE id = $1 FOR UPDATE`,
      [paymentIntentId]
    );

    if (!res.rows.length) throw new Error("INTENT_NOT_FOUND");

    const intent = res.rows[0];

    /* =====================================================
       2. IDEMPOTENT CHECK
    ===================================================== */

    if (intent.status === "paid") {
      const order = await client.query<{ id: string }>(
        `SELECT id FROM orders WHERE pi_payment_id = $1 LIMIT 1`,
        [piPaymentId]
      );

      return {
        ok: true,
        already: true,
        orderId: order.rows[0]?.id ?? null,
      };
    }

    if (
      intent.status !== "submitted" &&
      intent.status !== "verifying"
    ) {
      throw new Error("INVALID_STATUS");
    }

    /* =====================================================
       3. STRICT VALIDATION (NO NULL ALLOWED)
    ===================================================== */

    const expectedAmount = toNumber(intent.total_amount);

    if (!isSameAmount(expectedAmount, verifiedAmount)) {
      await auditManualReview(paymentIntentId, "AMOUNT_MISMATCH", {
        expectedAmount,
        verifiedAmount,
      });
      throw new Error("AMOUNT_MISMATCH");
    }

    if (
      (intent.merchant_wallet || "").trim() !== (receiverWallet || "").trim()
    ) {
      await auditManualReview(paymentIntentId, "RECEIVER_MISMATCH", {
        expected: intent.merchant_wallet,
        got: receiverWallet,
      });
      throw new Error("RECEIVER_MISMATCH");
    }

    /* =====================================================
       4. MARK INTENT PRE-SETTLED
    ===================================================== */

    await client.query(
      `
      UPDATE payment_intents
      SET settlement_state = 'PROCESSING',
          updated_at = now()
      WHERE id = $1
      `,
      [paymentIntentId]
    );

    /* =====================================================
       5. CREATE ORDER (ATOMIC CORE)
    ===================================================== */

    const orderRes = await client.query<{ id: string }>(
      `
      INSERT INTO orders (
        buyer_id,
        seller_id,
        pi_payment_id,
        pi_txid,
        payment_status,
        paid_at,
        subtotal,
        discount,
        shipping_fee,
        total,
        currency,
        status,
        shipping_name,
        shipping_phone,
        shipping_address_line,
        shipping_country,
        shipping_zone
      )
      VALUES (
        $1,$2,$3,$4,
        'paid',now(),
        $5,$6,$7,$8,$9,
        'pending',
        $10,$11,$12,$13,$14
      )
      RETURNING id
      `,
      [
        intent.buyer_id,
        intent.seller_id,
        piPaymentId,
        txid,
        intent.subtotal,
        intent.discount,
        intent.shipping_fee,
        intent.total_amount,
        intent.currency,
        intent.shipping_snapshot?.name ?? "",
        intent.shipping_snapshot?.phone ?? "",
        intent.shipping_snapshot?.address_line ?? "",
        intent.country,
        intent.zone,
      ]
    );

    const orderId = orderRes.rows[0].id;

    /* =====================================================
       6. ORDER ITEM
    ===================================================== */

    await client.query(
      `
      INSERT INTO order_items (
        order_id,
        seller_id,
        product_id,
        variant_id,
        quantity,
        unit_price,
        total_price,
        currency,
        snapshot
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        orderId,
        intent.seller_id,
        intent.product_id,
        intent.variant_id,
        intent.quantity,
        intent.unit_price,
        toNumber(intent.unit_price) * intent.quantity,
        intent.currency,
        JSON.stringify({ paymentIntentId, piPaymentId, txid }),
      ]
    );

    /* =====================================================
       7. PAYMENT RECEIPT
    ===================================================== */

    await client.query(
      `
      INSERT INTO payment_receipts (
        payment_intent_id,
        pi_payment_id,
        txid,
        verified_amount,
        receiver_wallet,
        verification_status,
        pi_payload,
        rpc_payload,
        order_id
      )
      VALUES ($1,$2,$3,$4,$5,'verified',$6,$7,$8)
      `,
      [
        paymentIntentId,
        piPaymentId,
        txid,
        verifiedAmount,
        receiverWallet,
        JSON.stringify(piPayload),
        JSON.stringify(rpcPayload),
        orderId,
      ]
    );

    /* =====================================================
       8. PI PAYMENT UPSERT
    ===================================================== */

    await client.query(
      `
      INSERT INTO pi_payments (
        user_id,
        pi_payment_id,
        txid,
        amount,
        currency,
        status,
        expected_amount,
        verified_amount,
        order_id,
        raw,
        completed_at
      )
      VALUES (
        $1,$2,$3,$4,'PI','completed',
        $5,$6,$7,$8,now()
      )
      ON CONFLICT (pi_payment_id)
      DO UPDATE SET
        txid = EXCLUDED.txid,
        status = 'completed',
        verified_amount = EXCLUDED.verified_amount,
        order_id = EXCLUDED.order_id,
        updated_at = now()
      `,
      [
        intent.buyer_id,
        piPaymentId,
        txid,
        verifiedAmount,
        expectedAmount,
        verifiedAmount,
        orderId,
        JSON.stringify({ pi: piPayload, rpc: rpcPayload }),
      ]
    );

    /* =====================================================
       9. LEDGER (SAFE ISOLATED)
    ===================================================== */

    try {
      const escrowId = await SettlementLedgerV3.createEscrow({
        paymentIntentId,
        orderId,
        buyerId: intent.buyer_id,
        sellerId: intent.seller_id,
        amount: verifiedAmount,
        txid,
        piPaymentId,
      });

      await SettlementLedgerV3.markPiVerified(escrowId);
      await SettlementLedgerV3.markRpcVerified(escrowId);
      await SettlementLedgerV3.linkOrder(escrowId, orderId);
      await SettlementLedgerV3.creditSeller({
        escrowId,
        sellerId: intent.seller_id,
        amount: verifiedAmount,
      });
      await SettlementLedgerV3.releaseEscrow(escrowId);
    } catch (e) {
      console.error("[LEDGER_FAIL]", e);
    }

    /* =====================================================
       10. FINALIZE INTENT
    ===================================================== */

    await client.query(
      `
      UPDATE payment_intents
      SET status = 'paid',
          settlement_state = 'SETTLED',
          pi_payment_id = $2,
          txid = $3,
          paid_at = now(),
          updated_at = now()
      WHERE id = $1
      `,
      [paymentIntentId, piPaymentId, txid]
    );

    /* =====================================================
       11. AUDIT
    ===================================================== */

    await auditFinalizeDone(paymentIntentId, { orderId });

    return {
      ok: true,
      orderId,
    };
  });
}
