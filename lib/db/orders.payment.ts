import { withTransaction } from "@/lib/db";
import { auditManualReview } from "@/lib/db/payments.audit";

/* =========================================================
   TYPES
========================================================= */

type FinalizePaidOrderParams = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
  verifiedAmount: number;
  receiverWallet: string;
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
};

export type FinalizePaidOrderResult = {
  ok: boolean;
  already: boolean;
  orderId: string | null;
  buyerId: string;
  sellerId: string;
  amount: number;
};

/* =========================================================
   HELPERS
========================================================= */

function toNumber(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error("INVALID_NUMBER");
  }
  return n;
}

function isSameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0000001;
}

/* =========================================================
   FINALIZER
========================================================= */

export async function finalizePaidOrderFromIntent({
  paymentIntentId,
  piPaymentId,
  txid,
  verifiedAmount,
  receiverWallet,
  piPayload,
  rpcPayload,
}: FinalizePaidOrderParams): Promise<FinalizePaidOrderResult> {
  return withTransaction(async (client) => {
    /* =====================================================
       1. LOCK PAYMENT INTENT
    ===================================================== */

    const rs = await client.query<PaymentIntentRow>(
      `
      SELECT *
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

    /* =====================================================
       2. IDEMPOTENT IF ALREADY PAID
    ===================================================== */

    if (intent.status === "paid") {
      const existedOrder = await client.query<{ id: string }>(
        `
        SELECT id
        FROM orders
        WHERE pi_payment_id = $1
        LIMIT 1
        `,
        [piPaymentId]
      );

      return {
        ok: true,
        already: true,
        orderId: existedOrder.rows[0]?.id ?? null,
        buyerId: intent.buyer_id,
        sellerId: intent.seller_id,
        amount: verifiedAmount,
      };
    }

    if (
      intent.status !== "verifying" &&
      intent.status !== "submitted" &&
      intent.status !== "wallet_opened"
    ) {
      throw new Error("INVALID_PAYMENT_STATUS");
    }

    /* =====================================================
       3. STRICT AMOUNT + RECEIVER VALIDATION
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
      String(intent.merchant_wallet || "").trim().toLowerCase() !==
      String(receiverWallet || "").trim().toLowerCase()
    ) {
      await auditManualReview(paymentIntentId, "RECEIVER_MISMATCH", {
        expected: intent.merchant_wallet,
        got: receiverWallet,
      });
      throw new Error("RECEIVER_MISMATCH");
    }

    /* =====================================================
       4. CREATE ORDER
    ===================================================== */

    const orderRes = await client.query<{ id: string }>(
      `
      INSERT INTO orders (
        buyer_id,
        seller_id,

        pi_payment_id,
        pi_txid,
        idempotency_key,

        payment_status,
        paid_at,

        items_total,
        subtotal,
        discount,
        shipping_fee,
        tax,
        total,
        currency,

        status,

        shipping_name,
        shipping_phone,
        shipping_address_line,
        shipping_country,
        shipping_zone,

        total_items,
        total_quantity,

        created_at,
        updated_at
      )
      VALUES (
        $1,$2,
        $3,$4,$5,
        'paid',now(),
        $6,$7,$8,$9,0,$10,$11,
        'confirmed',
        $12,$13,$14,$15,$16,
        1,$17,
        now(),now()
      )
      RETURNING id
      `,
      [
        intent.buyer_id,
        intent.seller_id,

        piPaymentId,
        txid,
        paymentIntentId,

        verifiedAmount,
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

        intent.quantity,
      ]
    );

    const orderId = orderRes.rows[0].id;

    /* =====================================================
       5. CREATE ORDER ITEM
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
        JSON.stringify({
          paymentIntentId,
          piPaymentId,
          txid,
          source: "payment_reconcile",
        }),
      ]
    );

    /* =====================================================
       6. CREATE PAYMENT RECEIPT
    ===================================================== */

    await client.query(
      `
      INSERT INTO payment_receipts (
        payment_intent_id,
        user_id,
        order_id,

        pi_payment_id,
        txid,

        expected_amount,
        verified_amount,
        currency,

        receiver_wallet,

        verification_status,
        verify_source,

        rpc_confirmed,
        rpc_ledger,
        chain_reference,

        pi_payload,
        rpc_payload,
        merged_payload,

        verified_at,
        completed_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,
        $4,$5,
        $6,$7,'PI',
        $8,
        'completed',
        'DUAL_AUDIT',
        $9,$10,$11,
        $12,$13,$14,
        now(),now(),now(),now()
      )
      ON CONFLICT (pi_payment_id) DO NOTHING
      `,
      [
        paymentIntentId,
        intent.buyer_id,
        orderId,

        piPaymentId,
        txid,

        expectedAmount,
        verifiedAmount,

        receiverWallet,

        (rpcPayload as any)?.ok === true,
        (rpcPayload as any)?.ledger ?? null,
        (rpcPayload as any)?.chainReference ?? null,

        JSON.stringify(piPayload),
        JSON.stringify(rpcPayload),
        JSON.stringify({
          pi: piPayload,
          rpc: rpcPayload,
        }),
      ]
    );

    /* =====================================================
       7. UPSERT PI PAYMENTS (FULL SCHEMA FIX)
    ===================================================== */

    await client.query(
      `
      INSERT INTO pi_payments (
        payment_intent_id,
        order_id,
        user_id,

        pi_payment_id,
        txid,
        receiver_wallet,

        amount,
        expected_amount,
        verified_amount,
        currency,

        status,

        reconcile_attempts,
        last_reconcile_at,

        pi_raw_payload,
        rpc_raw_payload,
        complete_raw_payload,

        completed_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,
        $4,$5,$6,
        $7,$8,$9,'PI',
        'SETTLED',
        1,now(),
        $10,$11,$12,
        now(),now(),now()
      )
      ON CONFLICT (pi_payment_id)
      DO UPDATE SET
        txid = EXCLUDED.txid,
        order_id = EXCLUDED.order_id,
        receiver_wallet = EXCLUDED.receiver_wallet,
        verified_amount = EXCLUDED.verified_amount,
        status = 'SETTLED',
        pi_raw_payload = EXCLUDED.pi_raw_payload,
        rpc_raw_payload = EXCLUDED.rpc_raw_payload,
        complete_raw_payload = EXCLUDED.complete_raw_payload,
        last_reconcile_at = now(),
        completed_at = now(),
        updated_at = now()
      `,
      [
        paymentIntentId,
        orderId,
        intent.buyer_id,

        piPaymentId,
        txid,
        receiverWallet,

        verifiedAmount,
        expectedAmount,
        verifiedAmount,

        JSON.stringify(piPayload),
        JSON.stringify(rpcPayload),
        JSON.stringify({
          pi: piPayload,
          rpc: rpcPayload,
          finalized: true,
        }),
      ]
    );

    /* =====================================================
       8. FINALIZE PAYMENT INTENT
    ===================================================== */

    await client.query(
      `
      UPDATE payment_intents
      SET
        status = 'paid',
        settlement_state = 'ORDER_FINALIZED',
        pi_payment_id = $2,
        txid = $3,
        paid_at = now(),
        updated_at = now()
      WHERE id = $1
      `,
      [paymentIntentId, piPaymentId, txid]
    );

    /* =====================================================
       9. RETURN
    ===================================================== */

    return {
      ok: true,
      already: false,
      orderId,
      buyerId: intent.buyer_id,
      sellerId: intent.seller_id,
      amount: verifiedAmount,
    };
  });
}
