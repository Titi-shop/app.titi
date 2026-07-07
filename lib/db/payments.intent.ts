import crypto from "crypto";
import type { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/db";
import type {
  PricingResult,
} from "@/lib/payments/pricing.engine";

import type {
  CreateIntentResult,
  PaymentIntentRow,
  ExpiredPaymentIntentRow,
} from "@/lib/payments/types/intent.type";
import {
  logger,
  maskId,
} from "@/lib/logger";
/* =========================================================
   GLOBAL WALLET
========================================================= */

const APP_MERCHANT_WALLET = (
  process.env.PI_MERCHANT_WALLET || ""
).trim();
logger.info(
  "PAYMENT_INTENT.CONFIG_READY",
  {
    merchant:
      maskId(APP_MERCHANT_WALLET),
  }
);
/* =========================================================
   HELPERS
========================================================= */

function safeUUID(): string {
  return crypto.randomUUID();
}

function makeNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

function makeVerifyToken(): string {
  return crypto.randomBytes(20).toString("hex");
}

function makeInitialStatus(): PaymentIntentStatus {
  return "created";
}

function makeInitialSettlement(): SettlementState {
  return "UNSETTLED";
}
function makeExpiresAt(): Date {
  return new Date(
    Date.now() + 30 * 60 * 1000
  );
}
async function lockAndValidateInventory(
    client: PoolClient,
    productId: string,
    variantId: string | null,
    quantity: number
){
  // ==============================
  // PRODUCT VARIANT
  // ==============================
  if (variantId) {
    const res = await client.query(
      `
      SELECT
        id,
        product_id,
        stock,
        reserved_stock,
        is_unlimited
      FROM product_variants
      WHERE id = $1
        AND product_id = $2
      FOR UPDATE
      `,
      [variantId, productId]
    );

    if (!res.rows.length) {
      throw new Error("VARIANT_NOT_FOUND");
    }

    const variant = res.rows[0];

    const available =
      Number(variant.stock) -
      Number(variant.reserved_stock ?? 0);

    if (
      !variant.is_unlimited &&
      available < quantity
    ) {
      throw new Error("VARIANT_OUT_OF_STOCK");
    }

    await client.query(
      `
      UPDATE product_variants
      SET reserved_stock = reserved_stock + $1
      WHERE id = $2
      `,
      [quantity, variantId]
    );

    return;
  }

  // ==============================
  // NORMAL PRODUCT
  // ==============================
  const res = await client.query(
    `
    SELECT
      id,
      stock,
      reserved_stock,
      is_unlimited
    FROM products
    WHERE id = $1
    FOR UPDATE
    `,
    [productId]
  );

  if (!res.rows.length) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const product = res.rows[0];

  const available =
    Number(product.stock) -
    Number(product.reserved_stock ?? 0);

  if (
    !product.is_unlimited &&
    available < quantity
  ) {
    throw new Error("OUT_OF_STOCK");
  }

  await client.query(
    `
    UPDATE products
    SET reserved_stock = reserved_stock + $1
    WHERE id = $2
    `,
    [quantity, productId]
  );
}

/* =========================================================
   MAIN
========================================================= */

export async function createPiPaymentIntent({
  userId,
  productId,
  variantId,
  quantity,
  country,
  zone,
  shipping,
  pricing,
}: CreatePiPaymentIntentInput): Promise<CreateIntentResult> {
 try {
  logger.info(
    "PAYMENT_INTENT.START",
    {
        userId:
            maskId(userId),

        productId:
            maskId(productId),

        variantId:
            variantId
                ? maskId(variantId)
                : null,
    }
);

  if (!APP_MERCHANT_WALLET) {
    throw new Error("APP_MERCHANT_WALLET_MISSING");
  }

  return withTransaction(async (client) => {

    /* =====================================================
       1. VALIDATE PRICING (SOURCE OF TRUTH)
    ===================================================== */

    if (!pricing.items.length) {
      throw new Error("INVALID_PRICING");
    }

    const item = pricing.items[0];

    if (item.product_id !== productId) {
      throw new Error("PRICING_PRODUCT_MISMATCH");
    }

    if ((item.variant_id ?? null) !== (variantId ?? null)) {
      throw new Error("PRICING_VARIANT_MISMATCH");
    }

    logger.info(
  "PAYMENT_INTENT.PRICING_OK",
  {
    subtotal: pricing.subtotal,
    total: pricing.total,
  }
);

    /* =====================================================
       2. VERIFY OWNER (NO PRODUCT QUERY)
    ===================================================== */

    const ownerRes = await client.query<{
  seller_id: string;
}>(
  `
  SELECT seller_id
  FROM products
  WHERE id = $1
  LIMIT 1
  `,
  [productId]
);

    if (!ownerRes.rows.length) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    const seller_id = ownerRes.rows[0].seller_id;

    if (seller_id === userId) {
      throw new Error("SELF_PAYMENT_FORBIDDEN");
    }

    logger.info(
    "PAYMENT_INTENT.OWNER_OK",
    {
        sellerId:
            maskId(seller_id),
    }
);
await lockAndValidateInventory(
  client,
  productId,
  variantId ?? null,
  quantity
);

logger.info(
  "PAYMENT_INTENT.INVENTORY_OK"
);
    /* =====================================================
       3. IDS
    ===================================================== */

    const paymentIntentId = safeUUID();
    const nonce = makeNonce();
    const verifyToken = makeVerifyToken();
    const idempotencyKey = safeUUID();

    const memo = `ORDER-${paymentIntentId.slice(0, 8)}`;
     const expiresAt = makeExpiresAt();
    logger.debug(
  "PAYMENT_INTENT.INITIAL_STATE",
  {
    status:
      makeInitialStatus(),
    settlementState:
      makeInitialSettlement(),
    paymentState:
      "PENDING",
    providerStatus:
      "CREATED",
    expiresAt,
  }
);
    /* =====================================================
       4. SNAPSHOT (TRUST PRICING ENGINE)
    ===================================================== */

    const shippingSnapshot = {
  buyer_shipping: shipping,
  buyer_country:
    pricing.buyer_country,
  buyer_zone:
    pricing.buyer_zone,
  pricing_snapshot: pricing,
  product_snapshot:
    pricing.items[0] ?? null,
  variant_snapshot: null,
} as const;


    /* =====================================================
       5. INSERT INTENT
    ===================================================== */
logger.info(
  "PAYMENT_INTENT.INSERT_PREPARE",
  {
    paymentIntentId:
      maskId(paymentIntentId),

    buyerId:
      maskId(userId),

    sellerId:
      maskId(seller_id),

    productId:
      maskId(productId),

    variantId:
      variantId
        ? maskId(variantId)
        : null,

    quantity,

    total:
      pricing.total,
  }
);
    await client.query(
      `
      INSERT INTO payment_intents (
        id,
        nonce,
        idempotency_key,
        verify_token,

        buyer_id,
        seller_id,

        product_id,
        variant_id,
        quantity,

        unit_price,
        subtotal,
        discount,
        shipping_fee,
        total_amount,

        currency,
        shipping_snapshot,

        country,
        zone,

        merchant_wallet,

        status,
        settlement_state,
        payment_state,
        provider_status,
        expires_at
      )
      VALUES (
        $1,$2,$3,$4,
        $5,$6,
        $7,$8,$9,
        $10,$11,$12,$13,$14,
        'PI',
        $15,
        $16,$17,
        $18,
        $19,$20,$21,$22,$23
      )
      `,
      [
        paymentIntentId,
        nonce,
        idempotencyKey,
        verifyToken,

        userId,
        seller_id,

        productId,
        variantId,
        quantity,

        item.unit_price,
        pricing.subtotal,
        0,
        pricing.shipping_fee,
        pricing.total,

        JSON.stringify(shippingSnapshot),

        pricing.buyer_country,
        pricing.buyer_zone,

        APP_MERCHANT_WALLET,

      makeInitialStatus(),
      
      makeInitialSettlement(),
      "PENDING",
      "CREATED",
      expiresAt,
      ]
    );

    logger.info(
  "PAYMENT_INTENT.INSERT_OK",
  {
    paymentIntentId:
      maskId(paymentIntentId),

    total:
      pricing.total,
  }
);

    return {
      ok: true,
      payment_intent_id: paymentIntentId,
      amount: pricing.total,
      currency: "PI",
      merchant_wallet: APP_MERCHANT_WALLET,
      memo,
      metadata: {
        payment_intent_id: paymentIntentId,
      },
    };
  });
 
   } catch (error) {
  logger.error(
    "PAYMENT_INTENT.ERROR",
    {
      message:
        error instanceof Error
          ? error.message
          : "UNKNOWN_ERROR",
    }
  );
  throw error;
}
}
/* =========================================================
   GET PAYMENT INTENT
========================================================= */
export async function getPaymentIntent(
  id: string
): Promise<PaymentIntentRow | null> {
  logger.info(
  "PAYMENT_INTENT.GET_START",
  {
    paymentIntentId:
      maskId(id),
  }
);
  const res =
    await query<PaymentIntentRow>(
    `
    SELECT *
    FROM payment_intents
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

logger.info(
  "PAYMENT_INTENT.GET_RESULT",
  {
    found:
      res.rows.length > 0,

    paymentIntentId:
      maskId(id),

    status:
      res.rows[0]?.status,

    settlementState:
      res.rows[0]?.settlement_state,

    paymentState:
      res.rows[0]?.payment_state,

    providerStatus:
      res.rows[0]?.provider_status,
  }
);

return res.rows[0] ?? null;
}

export async function releaseReservedStock(
  client: PoolClient,
  productId: string,
  variantId: string | null,
  quantity: number
) {
  logger.info(
    "PAYMENT_INTENT.RELEASE_RESERVED.START",
    {
      productId: maskId(productId),
      variantId: variantId ? maskId(variantId) : null,
      quantity,
    }
  );

  if (variantId) {
    await client.query(
      `
      UPDATE product_variants
      SET reserved_stock =
        GREATEST(reserved_stock - $1, 0)
      WHERE id = $2
      `,
      [quantity, variantId]
    );

    logger.info("PAYMENT_INTENT.RELEASE_RESERVED.SUCCESS");
    return;
  }

  await client.query(
    `
    UPDATE products
    SET reserved_stock =
      GREATEST(reserved_stock - $1, 0)
    WHERE id = $2
    `,
    [quantity, productId]
  );

  logger.info("PAYMENT_INTENT.RELEASE_RESERVED.SUCCESS");
}

export async function findExpiredPaymentIntents(
  client: PoolClient
): Promise<ExpiredPaymentIntentRow[]> {

  logger.info(
    "PAYMENT_INTENT.FIND_EXPIRED.START"
  );

  const res =
    await client.query<ExpiredPaymentIntentRow>(
      `
      SELECT
        id,
        product_id,
        variant_id,
        quantity
      FROM payment_intents
      WHERE
        expires_at <= now()
        AND status IN (
          'created',
          'submitted',
          'authorized'
        )
      FOR UPDATE
      `
    );

  logger.info(
    "PAYMENT_INTENT.FIND_EXPIRED.DONE",
    {
      count: res.rows.length,
    }
  );

  return res.rows;
}

export async function expirePaymentIntentFlow({
  client,
  intent,
}: {
  client: PoolClient;
  intent: ExpiredPaymentIntentRow;
}) {

  logger.info(
    "PAYMENT_INTENT.EXPIRE.START",
    {
      paymentIntentId: maskId(intent.id),
    }
  );

  await releaseReservedStock(
    client,
    intent.product_id,
    intent.variant_id,
    intent.quantity
  );

  await client.query(
    `
    UPDATE payment_intents
    SET
      status = 'expired',
      payment_state = 'EXPIRED',
      provider_status = 'EXPIRED',
      updated_at = NOW()
    WHERE id = $1
    `,
    [intent.id]
  );

  logger.info(
    "PAYMENT_INTENT.EXPIRE.SUCCESS",
    {
      paymentIntentId: maskId(intent.id),
    }
  );
}
