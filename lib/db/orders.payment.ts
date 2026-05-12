
import { withTransaction } from "@/lib/db";
import {
  auditManualReview,
  writePaymentAudit,
} from "@/lib/db/payments.audit";

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
  intent,
}: FinalizePaidOrderParams & { intent: PaymentIntentRow }) {
  return withTransaction(async (client) => {
    /* =====================================================
       1. SHIPPING VALIDATION
    ===================================================== */

    const rawShipping =
      typeof intent.shipping_snapshot === "string"
        ? JSON.parse(intent.shipping_snapshot)
        : intent.shipping_snapshot;

    const shipping: ShippingSnapshot =
      rawShipping?.buyer_shipping ?? rawShipping ?? {};

    if (!shipping.name || !shipping.phone || !shipping.address_line) {
      await auditManualReview(
        paymentIntentId,
        "INVALID_SHIPPING_SNAPSHOT",
        { shipping },
        client
      );
      throw new Error("INVALID_SHIPPING_SNAPSHOT");
    }

    /* =====================================================
       2. IDEMPOTENT CHECK
    ===================================================== */

    if (intent.status === "paid") {
      const existedOrder = await client.query<{ id: string }>(
        `SELECT id FROM orders WHERE pi_payment_id = $1 LIMIT 1`,
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
       3. AMOUNT + WALLET VALIDATION
    ===================================================== */

    const expectedAmount = Number(intent.total_amount);

    if (Math.abs(expectedAmount - verifiedAmount) > 0.000001) {
      await auditManualReview(paymentIntentId, "AMOUNT_MISMATCH", {
        expectedAmount,
        verifiedAmount,
      });
      throw new Error("AMOUNT_MISMATCH");
    }

    if (
      String(intent.merchant_wallet || "").toLowerCase() !==
      String(receiverWallet || "").toLowerCase()
    ) {
      await auditManualReview(paymentIntentId, "RECEIVER_MISMATCH", {
        expected: intent.merchant_wallet,
        got: receiverWallet,
      });
      throw new Error("RECEIVER_MISMATCH");
    }

    /* =====================================================
       4. AUDIT START
    ===================================================== */

    await writePaymentAudit({
      paymentIntentId,
      eventCode: "ORDER_FINALIZE_STARTED",
      stage: "FINALIZE",
      actorType: "system",
      piPaymentId,
      txid,
      source: "orders.payment",
      newSettlementState: "FINALIZING_ORDER",
      payload: { verifiedAmount, receiverWallet },
    });

    /* =====================================================
       5. ORDER CREATE
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
        fulfillment_status,

        settlement_status,
        shipment_status,
        delivery_status,

        items_total,
        subtotal,
        discount,
        shipping_fee,
        tax,
        total,
        currency,

        shipping_name,
        shipping_phone,
        shipping_address_line,
        shipping_ward,
        shipping_district,
        shipping_region,
        shipping_country,
        shipping_postal_code,

        total_items,
        total_quantity,

        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,
        'paid',now(),'pending_fulfillment',
        'ESCROWED','PENDING','PENDING',
        $6,$7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,
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

        intent.subtotal,
        intent.subtotal,
        intent.discount,
        intent.shipping_fee,
        0,
        intent.total_amount,
        intent.currency,

        shipping.name ?? "",
        shipping.phone ?? "",
        shipping.address_line ?? "",
        shipping.ward ?? null,
        shipping.district ?? null,
        shipping.region ?? null,
        shipping.country ?? intent.country,
        shipping.postal_code ?? null,

        intent.quantity,
        intent.quantity,
      ]
    );

    const orderId = orderRes.rows[0].id;

    /* =====================================================
       6. LOCK + NOTE + REVIEW REASON (FIX CORE ISSUE)
    ===================================================== */

    const processingLockId = `${paymentIntentId}:${piPaymentId}`;
    const processingLockedAt = new Date();
    const manualReviewReason = rpcPayload?.reason ?? null;

    const note = JSON.stringify({
      stage: "FINALIZE",
      txid,
      piMemo: piPayload?.memo,
      rpcStage: rpcPayload?.stage,
    });

    /* =====================================================
       7. ORDER ITEM
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
        Number(intent.unit_price) * intent.quantity,
        intent.currency,
        JSON.stringify({ paymentIntentId, piPaymentId, txid }),
      ]
    );

    /* =====================================================
       8. PAYMENT RECEIPT
    ===================================================== */

    await client.query(
      `
      INSERT INTO payment_receipts (
        payment_intent_id,
        user_id,
        order_id,
        escrow_id,
        pi_payment_id,
        pi_uid,
        txid,
        expected_amount,
        verified_amount,
        currency,
        sender_wallet,
        receiver_wallet,
        verification_status,
        verify_source,
        settlement_state,
        rpc_confirmed,
        rpc_ledger,
        chain_reference,
        tx_status,
        developer_completed,
        rpc_reason,
        pi_payload,
        rpc_payload,
        merged_payload,
        developer_completed_at,
        pi_created_at,
        pi_memo,
        rpc_tx_status,
        rpc_stage,
        idempotency_key,
        verified_at,
        completed_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,
        $11,$12,
        $13,$14,$15,
        $16,$17,$18,
        $19,$20,$21,
        $22,$23,$24,
        $25,$26,$27,
        $28,$29,$30,
        now(),now(),now(),now()
      )
      `,
      [
        paymentIntentId,
        intent.buyer_id,
        orderId,
        null,
        piPaymentId,
        piPayload?.user_uid ?? null,
        txid,

        expectedAmount,
        verifiedAmount,
        "PI",

        piPayload?.from_address ?? null,
        piPayload?.to_address ?? receiverWallet,

        "completed",
        "DUAL_AUDIT",
        "ORDER_FINALIZED",

        rpcPayload?.confirmed ?? rpcPayload?.ok ?? false,
        rpcPayload?.ledger ?? null,
        rpcPayload?.chainReference ?? txid,

        rpcPayload?.txStatus ?? "CONFIRMED",
        piPayload?.status?.developer_completed ?? false,
        manualReviewReason,

        JSON.stringify(piPayload),
        JSON.stringify(rpcPayload),
        JSON.stringify({ pi: piPayload, rpc: rpcPayload }),

        piPayload?.status?.developer_completed ? new Date() : null,
        piPayload?.created_at ?? null,
        piPayload?.memo ?? null,

        rpcPayload?.txStatus ?? "CONFIRMED",
        rpcPayload?.stage ?? null,
        paymentIntentId,
      ]
    );

    /* =====================================================
       9. PI_PAYMENTS (FIXED 4 NULL COLUMNS)
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

        payment_nonce,
        verify_token,
        idempotency_key,

        country,
        zone,

        failure_reason,
        manual_review_reason,
        note,

        processing_lock_id,
        processing_locked_at,

        pi_raw_payload,
        rpc_raw_payload,
        complete_raw_payload,

        completed_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,
        $12,$13,
        $14,$15,$16,
        $17,$18,
        $19,$20,$21,
        $22,$23,
        $24,$25,$26,
        $27,$28,$29
      )
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
        "PI",
        "SETTLED",

        1,
        new Date(),

        piPayload?.identifier ?? null,
        rpcPayload?.chainReference ?? txid,
        paymentIntentId,

        intent.country ?? null,
        intent.zone ?? null,

        rpcPayload?.reason ?? null,
        manualReviewReason,
        note,

        processingLockId,
        processingLockedAt,

        JSON.stringify(piPayload),
        JSON.stringify(rpcPayload),
        JSON.stringify({ pi: piPayload, rpc: rpcPayload }),

        new Date(),
        new Date(),
        new Date(),
      ]
    );

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
