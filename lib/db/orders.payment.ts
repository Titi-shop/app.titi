
import { withTransaction } from "@/lib/db";

import {
  auditManualReview,
  writePaymentAudit,
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
  piPayload: PiPayload;
rpcPayload: RpcPayload;
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
type RpcPayload = {
  ok: boolean;
  ledger?: number | null;
  chainReference?: string | null;
  stage?: string | null;
  sender?: string | null;
  receiver?: string | null;
  reason?: string | null;
};

type PiPayload = {
  user_uid?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  amount?: number | string | null;
  status?: {
    developer_approved?: boolean;
  };
};
   type ShippingSnapshot = {
  name?: string | null;
  phone?: string | null;
  address_line?: string | null;
  ward?: string | null;
  district?: string | null;
  region?: string | null;
  country?: string | null;
  postal_code?: string | null;
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
  intent, 
}: FinalizePaidOrderParams & { intent: PaymentIntentRow }) {
  return withTransaction(async (client) => {
    /* =====================================================
       1. LOCK PAYMENT INTENT
    ===================================================== */

const rawShipping =
  typeof intent.shipping_snapshot === "string"
    ? JSON.parse(intent.shipping_snapshot)
    : intent.shipping_snapshot;

const shipping: ShippingSnapshot =
  rawShipping?.buyer_shipping ?? rawShipping ?? {};

if (
  !shipping.name ||
  !shipping.phone ||
  !shipping.address_line
) {
  await auditManualReview(
  paymentIntentId,
  "INVALID_SHIPPING_SNAPSHOT",
  {
    shipping,
  },
  client
);

  throw new Error("INVALID_SHIPPING_SNAPSHOT");
}
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
await writePaymentAudit({
  paymentIntentId,
  eventCode: "ORDER_FINALIZE_STARTED",
  stage: "FINALIZE",
  actorType: "system",
  piPaymentId,
  txid,
  source: "orders.payment",
  newSettlementState: "FINALIZING_ORDER",
  payload: {
    verifiedAmount,
    receiverWallet,
  },
});
     
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
    $1,  -- buyer_id
    $2,  -- seller_id

    $3,  -- pi_payment_id
    $4,  -- pi_txid
    $5,  -- idempotency_key

    'paid',
    now(),

    'pending_fulfillment',

    'ESCROWED',
    'PENDING',
    'PENDING',

    $6,  -- items_total
    $7,  -- subtotal
    $8,  -- discount
    $9,  -- shipping_fee
    $10, -- tax
    $11, -- total
    $12, -- currency

    $13, -- shipping_name
    $14, -- shipping_phone
    $15, -- shipping_address_line
    $16, -- shipping_ward
    $17, -- shipping_district
    $18, -- shipping_region
    $19, -- shipping_country
    $20, -- shipping_postal_code

    $21, -- total_items
    $22, -- total_quantity

    now(),
    now()
  )
  RETURNING id
  `,
  [
    // $1
    intent.buyer_id,

    // $2
    intent.seller_id,

    // $3
    piPaymentId,

    // $4
    txid,

    // $5
    paymentIntentId,

    // $6 items_total
    intent.subtotal,

    // $7 subtotal
    intent.subtotal,

    // $8 discount
    intent.discount,

    // $9 shipping_fee
    intent.shipping_fee,

    // $10 tax
    0,

    // $11 total
    intent.total_amount,

    // $12 currency
    intent.currency,

    // $13 shipping_name
    shipping.name ?? "",

    // $14 shipping_phone
    shipping.phone ?? "",

    // $15 shipping_address_line
    shipping.address_line ?? "",

    // $16 shipping_ward
    shipping.ward ?? null,

    // $17 shipping_district
    shipping.district ?? null,

    // $18 shipping_region
    shipping.region ?? null,

    // $19 shipping_country
    shipping.country ?? intent.country,

    // $20 shipping_postal_code
    shipping.postal_code ?? null,

    // $21 total_items
    intent.quantity,

    // $22 total_quantity
    intent.quantity,
  ]
);

    const orderId = orderRes.rows[0].id;
    await writePaymentAudit({
  paymentIntentId,
  eventCode: "ORDER_CREATED",
  stage: "FINALIZE",
  actorType: "system",
  piPaymentId,
  txid,
  source: "orders.payment",
  orderId,
  newSettlementState: "ORDER_CREATED",
});
if (!orderId) {
  throw new Error("ORDER_CREATE_FAILED");
}
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

    pi_payload,
    rpc_payload,
    merged_payload,

    idempotency_key,

    verified_at,
    completed_at,
    created_at,
    updated_at
  )
  VALUES (
    $1,$2,$3,$4,
    $5,$6,$7,
    $8,$9,$10,
    $11,$12,
    $13,$14,$15,
    $16,$17,$18,
    $19,$20,$21,
    $22,
    now(),now(),now(),now()
  )
  ON CONFLICT (pi_payment_id)
  DO UPDATE SET
    order_id = EXCLUDED.order_id,
    escrow_id = EXCLUDED.escrow_id,
    pi_uid = EXCLUDED.pi_uid,
    sender_wallet = EXCLUDED.sender_wallet,
    receiver_wallet = EXCLUDED.receiver_wallet,

    rpc_confirmed = EXCLUDED.rpc_confirmed,
    rpc_ledger = EXCLUDED.rpc_ledger,
    chain_reference = EXCLUDED.chain_reference,

    pi_payload = EXCLUDED.pi_payload,
    rpc_payload = EXCLUDED.rpc_payload,
    merged_payload = EXCLUDED.merged_payload,

    verification_status = EXCLUDED.verification_status,
    verify_source = EXCLUDED.verify_source,
    settlement_state = EXCLUDED.settlement_state,

    verified_at = now(),
    completed_at = now(),
    updated_at = now()
  `,
  [
    /* $1 */ paymentIntentId,
    /* $2 */ intent.buyer_id,
    /* $3 */ orderId,
    /* $4 */ null,

    /* $5 */ piPaymentId,
    /* $6 */ piPayload?.user_uid ?? null,
    /* $7 */ txid,

    /* $8 */ expectedAmount,
    /* $9 */ verifiedAmount,
    /* $10 */ "PI",

    /* $11 */ piPayload?.from_address ?? null,
    /* $12 */ piPayload?.to_address ?? receiverWallet,

    /* $13 */ "completed",
    /* $14 */ "DUAL_AUDIT",
    /* $15 */ "ORDER_FINALIZED",

    /* $16 */ rpcPayload?.ok ?? false,
    /* $17 */ rpcPayload?.ledger ?? null,
    /* $18 */ rpcPayload?.chainReference ?? null,

    /* $19 */ JSON.stringify(piPayload),
    /* $20 */ JSON.stringify(rpcPayload),
    /* $21 */ JSON.stringify({
      pi: piPayload,
      rpc: rpcPayload,
    }),

    /* $22 */ paymentIntentId,
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
        settlement_state = 'SETTLED'
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
