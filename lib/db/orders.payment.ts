import { withTransaction } from "@/lib/db";

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

  shipping_snapshot: unknown;
  country: string;
  zone: string;

  merchant_wallet: string;

  status: string;
  settlement_state: string;

  pi_payment_id: string | null;
  txid: string | null;
};

type ExistingOrderRow = {
  id: string;
};

type ExistingReceiptRow = {
  order_id: string | null;
};

type ShippingSnapshot = {
  name?: string;
  phone?: string;
  address_line?: string;
};

/* =========================================================
   HELPERS
========================================================= */

function toNumber(value: unknown): number {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    throw new Error("INVALID_NUMBER");
  }

  return n;
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.00001;
}

function normalizeShippingSnapshot(raw: unknown): ShippingSnapshot {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const obj = raw as Record<string, unknown>;

  return {
    name: typeof obj.name === "string" ? obj.name : "",
    phone: typeof obj.phone === "string" ? obj.phone : "",
    address_line:
      typeof obj.address_line === "string" ? obj.address_line : "",
  };
}

/* =========================================================
   FINALIZE PAID ORDER (PURE DB SOURCE OF TRUTH)
========================================================= */

export async function finalizePaidOrderFromIntent({
  paymentIntentId,
  piPaymentId,
  txid,
  verifiedAmount,
  receiverWallet,
  piPayload,
  rpcPayload,
}: FinalizePaidOrderParams): Promise<{
  ok: boolean;
  already: boolean;
  orderId: string | null;
  buyerId: string;
  sellerId: string;
}> {
  return withTransaction(async (client) => {
    console.log("[PAYMENT][FINALIZE] START", {
      paymentIntentId,
      piPaymentId,
      txid,
    });

    /* =====================================================
       1. LOCK INTENT
    ===================================================== */

    const intentRes = await client.query<PaymentIntentRow>(
      `
      SELECT *
      FROM payment_intents
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentIntentId]
    );

    if (!intentRes.rows.length) {
      throw new Error("INTENT_NOT_FOUND");
    }

    const intent = intentRes.rows[0];

    console.log("[PAYMENT][FINALIZE] INTENT_LOCKED", {
      status: intent.status,
      settlementState: intent.settlement_state,
    });

    /* =====================================================
       2. HARD IDEMPOTENT GUARD BY RECEIPT
    ===================================================== */

    const existingReceipt = await client.query<ExistingReceiptRow>(
      `
      SELECT order_id
      FROM payment_receipts
      WHERE pi_payment_id = $1
      LIMIT 1
      `,
      [piPaymentId]
    );

    if (existingReceipt.rows.length) {
      console.log("[PAYMENT][FINALIZE] RECEIPT_ALREADY_EXISTS");

      return {
        ok: true,
        already: true,
        orderId: existingReceipt.rows[0].order_id ?? null,
        buyerId: intent.buyer_id,
        sellerId: intent.seller_id,
      };
    }

    /* =====================================================
       3. HARD IDEMPOTENT GUARD BY ORDER
    ===================================================== */

    const existingOrder = await client.query<ExistingOrderRow>(
      `
      SELECT id
      FROM orders
      WHERE pi_payment_id = $1
      LIMIT 1
      `,
      [piPaymentId]
    );

    if (existingOrder.rows.length) {
      console.log("[PAYMENT][FINALIZE] ORDER_ALREADY_EXISTS");

      return {
        ok: true,
        already: true,
        orderId: existingOrder.rows[0].id,
        buyerId: intent.buyer_id,
        sellerId: intent.seller_id,
      };
    }

    /* =====================================================
       4. STATUS VALIDATION
    ===================================================== */

    if (
      intent.status !== "submitted" &&
      intent.status !== "verifying" &&
      intent.status !== "paid"
    ) {
      throw new Error("INVALID_STATUS");
    }

    /* =====================================================
       5. VERIFY AMOUNT + RECEIVER
    ===================================================== */

    const expectedAmount = toNumber(intent.total_amount);

    if (!sameAmount(expectedAmount, verifiedAmount)) {
      throw new Error("AMOUNT_MISMATCH");
    }

    if (
      intent.merchant_wallet.trim().toLowerCase() !==
      receiverWallet.trim().toLowerCase()
    ) {
      throw new Error("RECEIVER_MISMATCH");
    }

    const shipping = normalizeShippingSnapshot(intent.shipping_snapshot);

    /* =====================================================
       6. CREATE ORDER
    ===================================================== */

    const orderRes = await client.query<ExistingOrderRow>(
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
        shipping.name ?? "",
        shipping.phone ?? "",
        shipping.address_line ?? "",
        intent.country,
        intent.zone,
      ]
    );

    const orderId = orderRes.rows[0].id;

    console.log("[PAYMENT][FINALIZE] ORDER_CREATED", { orderId });

    /* =====================================================
       7. CREATE ORDER ITEM
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
        }),
      ]
    );

    /* =====================================================
       8. PAYMENT RECEIPT
    ===================================================== */

    await client.query(
      `
      INSERT INTO payment_receipts (
        payment_intent_id,
        pi_payment_id,
        txid,
        verified_amount,
        expected_amount,
        receiver_wallet,
        verification_status,
        verify_source,
        pi_payload,
        rpc_payload,
        order_id
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        'pi_verified',
        'PI_SERVER',
        $7,$8,$9
      )
      `,
      [
        paymentIntentId,
        piPaymentId,
        txid,
        verifiedAmount,
        expectedAmount,
        receiverWallet,
        JSON.stringify(piPayload ?? {}),
        JSON.stringify(rpcPayload ?? {}),
        orderId,
      ]
    );

    console.log("[PAYMENT][FINALIZE] RECEIPT_CREATED");

    /* =====================================================
       9. PI PAYMENTS UPSERT
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
        JSON.stringify({
          pi: piPayload ?? {},
          rpc: rpcPayload ?? {},
        }),
      ]
    );

    /* =====================================================
       10. FINALIZE INTENT
    ===================================================== */

    await client.query(
      `
      UPDATE payment_intents
      SET
        status = 'paid',
        settlement_state = 'SETTLED',
        pi_payment_id = $2,
        txid = $3,
        paid_at = now(),
        updated_at = now()
      WHERE id = $1
      `,
      [paymentIntentId, piPaymentId, txid]
    );

    console.log("[PAYMENT][FINALIZE] INTENT_PAID");

    return {
      ok: true,
      already: false,
      orderId,
      buyerId: intent.buyer_id,
      sellerId: intent.seller_id,
    };
  });
}
