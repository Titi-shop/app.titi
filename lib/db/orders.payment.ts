import { withTransaction } from "@/lib/db";
import { auditManualReview } from "@/lib/db/payments.audit";

/* =========================================================
   TYPES
========================================================= */

type RpcPayload = {
  ok: boolean;
  ledger?: number;
  chainReference?: string;
  confirmed?: boolean;
  sender?: string;
};

type PiPayload = {
  user_uid?: string;
};

interface FinalizeParams {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
  verifiedAmount: number;
  receiverWallet: string;
  piPayload: PiPayload;
  rpcPayload: RpcPayload;
}

interface PaymentIntentRow {
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

  shipping_snapshot: {
    name?: string;
    phone?: string;
    address_line?: string;
  } | null;

  country: string;
  zone: string;

  merchant_wallet: string;
  status: string;
}

interface FinalizeResult {
  ok: true;
  orderId: string;
  already: boolean;
  buyerId: string;
  sellerId: string;
  amount: number;
}

/* =========================================================
   HELPERS
========================================================= */

function toNumber(v: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("INVALID_NUMBER");
  return n;
}

function isSame(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.00001;
}

/* =========================================================
   FINALIZE (ONLY ONE SOURCE OF TRUTH)
========================================================= */

export async function finalizePaidOrderFromIntent(
  params: FinalizeParams
): Promise<FinalizeResult> {
  const {
    paymentIntentId,
    piPaymentId,
    txid,
    verifiedAmount,
    receiverWallet,
    piPayload,
    rpcPayload,
  } = params;

  return withTransaction(async (client) => {
    /* =========================
       LOCK INTENT
    ========================= */

    const rs = await client.query<PaymentIntentRow>(
      `
      SELECT * FROM payment_intents
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentIntentId]
    );

    if (!rs.rows[0]) throw new Error("INTENT_NOT_FOUND");

    const intent = rs.rows[0];

    /* =========================
       IDEMPOTENCY
    ========================= */

    if (intent.status === "paid") {
      const existed = await client.query<{ id: string }>(
        `
        SELECT id FROM orders
        WHERE pi_payment_id = $1
        LIMIT 1
        `,
        [piPaymentId]
      );

      return {
        ok: true,
        already: true,
        orderId: existed.rows[0]?.id ?? "",
        buyerId: intent.buyer_id,
        sellerId: intent.seller_id,
        amount: verifiedAmount,
      };
    }

    /* =========================
       VALIDATION
    ========================= */

    if (!["verifying", "submitted", "wallet_opened"].includes(intent.status)) {
      throw new Error("INVALID_INTENT_STATUS");
    }

    const expected = toNumber(intent.total_amount);

    if (!isSame(expected, verifiedAmount)) {
      await auditManualReview(paymentIntentId, "AMOUNT_MISMATCH", {
        expected,
        verifiedAmount,
      });
      throw new Error("AMOUNT_MISMATCH");
    }

    if (
      intent.merchant_wallet.toLowerCase() !== receiverWallet.toLowerCase()
    ) {
      await auditManualReview(paymentIntentId, "RECEIVER_MISMATCH", {
        expected: intent.merchant_wallet,
        got: receiverWallet,
      });
      throw new Error("RECEIVER_MISMATCH");
    }

    /* =========================
       CREATE ORDER
    ========================= */

    const order = await client.query<{ id: string }>(
      `
      INSERT INTO orders (
        buyer_id,
        seller_id,
        pi_payment_id,
        pi_txid,
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
        $3,$4,
        'paid',now(),
        $5,$6,$7,$8,0,$9,$10,
        'pending',
        $11,$12,$13,$14,$15,
        1,$16,
        now(),now()
      )
      RETURNING id
      `,
      [
        intent.buyer_id,
        intent.seller_id,

        piPaymentId,
        txid,

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

    const orderId = order.rows[0].id;

    /* =========================
       ORDER ITEM
    ========================= */

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

    /* =========================
       RECEIPT (FULL FIELDS FIXED)
    ========================= */

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
        sender_wallet,
        pi_uid,

        rpc_ledger,
        chain_reference,
        tx_status,

        pi_payload,
        rpc_payload,
        merged_payload,

        verification_status,
        verify_source,

        idempotency_key,

        verified_at,
        completed_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,'PI',
        $8,$9,$10,
        $11,$12,$13,
        $14,$15,$16,
        'completed',
        'DUAL_AUDIT',
        $17,
        now(),now(),now(),now()
      )
      `,
      [
        paymentIntentId,
        intent.buyer_id,
        orderId,
        piPaymentId,
        txid,

        expected,
        verifiedAmount,

        receiverWallet,
        (rpcPayload as RpcPayload)?.sender ?? null,
        (piPayload as PiPayload)?.user_uid ?? null,

        (rpcPayload as RpcPayload)?.ledger ?? null,
        (rpcPayload as RpcPayload)?.chainReference ?? null,
        (rpcPayload as RpcPayload)?.confirmed ? "confirmed" : "pending",

        JSON.stringify(piPayload),
        JSON.stringify(rpcPayload),
        JSON.stringify({ pi: piPayload, rpc: rpcPayload }),

        paymentIntentId,
      ]
    );

    /* =========================
       FINALIZE INTENT
    ========================= */

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
