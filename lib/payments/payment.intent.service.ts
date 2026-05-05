import { withTransaction } from "@/lib/db";
import crypto from "crypto";

import type {
  PaymentIntentStatus,
  SettlementState,
  Money,
} from "@/lib/payments/payment.types";

/* =========================================================
   TYPES
========================================================= */

type ShippingInput = {
  name: string;
  phone: string;
  address_line: string;
  ward?: string | null;
  district?: string | null;
  region?: string | null;
  postal_code?: string | null;
};

type CreatePiPaymentIntentInput = {
  userId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  country: string;
  zone: string;
  shipping: ShippingInput;
};

type ProductRow = {
  id: string;
  seller_id: string;
  name: string;
  slug: string;
  thumbnail: string | null;
  images: string[] | null;

  stock: number;
  sold: number;
  is_unlimited: boolean;
  is_digital: boolean;

  price: string;
  merchant_wallet: string | null;
};

type VariantRow = {
  id: string;
  product_id: string;

  stock: number;
  sold: number;
  is_unlimited: boolean;

  price: string;

  name: string | null;
  option_1: string | null;
  option_2: string | null;
  option_3: string | null;
  image: string | null;
};

type ShippingRateRow = {
  fee_pi: string;
};

type CreateIntentResult = {
  ok: boolean;
  payment_intent_id: string;
  amount: number;
  currency: "PI";
  merchant_wallet: string;
  memo: string;
  metadata: {
    payment_intent_id: string;
  };
};

/* =========================================================
   HELPERS
========================================================= */

function toMoney(n: unknown): Money {
  const v = Number(n);

  if (!Number.isFinite(v)) {
    throw new Error("INVALID_MONEY");
  }

  return {
    amount: v.toFixed(7),
    currency: "PI",
  };
}

function moneyAdd(a: Money, b: Money): Money {
  return toMoney(Number(a.amount) + Number(b.amount));
}

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
  return "INIT";
}

/* =========================================================
   MAIN CREATE INTENT
========================================================= */

export async function createPiPaymentIntent({
  userId,
  productId,
  variantId,
  quantity,
  country,
  zone,
  shipping,
}: CreatePiPaymentIntentInput): Promise<CreateIntentResult> {
  console.log("🟡 [CREATE_INTENT V7] START", {
    userId,
    productId,
    variantId,
    quantity,
    country,
    zone,
  });

  return withTransaction(async (client) => {
    console.log("🟡 [CREATE_INTENT V7] DB_TX_START");

    /* =====================================================
       1. LOCK PRODUCT
    ===================================================== */

    const productRes = await client.query<ProductRow>(
      `
      SELECT *
      FROM products
      WHERE id = $1
      FOR UPDATE
      `,
      [productId]
    );

    if (!productRes.rows.length) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    const product = productRes.rows[0];

    console.log("🟢 [CREATE_INTENT V7] PRODUCT_LOCKED", {
      productId: product.id,
      sellerId: product.seller_id,
      stock: product.stock,
    });

    /* =====================================================
       2. SELF BUY BLOCK
    ===================================================== */

    if (product.seller_id === userId) {
      throw new Error("SELF_PAYMENT_FORBIDDEN");
    }

    /* =====================================================
       3. LOCK VARIANT OR PRODUCT PRICE
    ===================================================== */

    let unitPrice = toMoney(product.price);

    if (variantId) {
      const vr = await client.query<VariantRow>(
        `
        SELECT *
        FROM product_variants
        WHERE id = $1
        FOR UPDATE
        `,
        [variantId]
      );

      if (!vr.rows.length) {
        throw new Error("VARIANT_NOT_FOUND");
      }

      const variant = vr.rows[0];

      if (!variant.is_unlimited && variant.stock < quantity) {
        throw new Error("OUT_OF_STOCK");
      }

      unitPrice = toMoney(variant.price);

      console.log("🟢 [CREATE_INTENT V7] VARIANT_LOCKED", {
        variantId,
        stock: variant.stock,
        unitPrice: unitPrice.amount,
      });
    } else {
      if (!product.is_unlimited && product.stock < quantity) {
        throw new Error("OUT_OF_STOCK");
      }
    }

    /* =====================================================
       4. SHIPPING RATE
    ===================================================== */

    let shippingFee = toMoney(0);

    if (!product.is_digital) {
      const ship = await client.query<ShippingRateRow>(
        `
        SELECT fee_pi
        FROM shipping_rates
        WHERE seller_id = $1
          AND zone = $2
        LIMIT 1
        `,
        [product.seller_id, zone]
      );

      shippingFee = toMoney(ship.rows[0]?.fee_pi ?? 0);
    }

    console.log("🟢 [CREATE_INTENT V7] SHIPPING_OK", {
      shippingFee: shippingFee.amount,
      zone,
    });

    /* =====================================================
       5. MONEY CALC
    ===================================================== */

    const subtotal = toMoney(Number(unitPrice.amount) * quantity);
    const discount = toMoney(0);
    const total = moneyAdd(moneyAdd(subtotal, shippingFee), discount);

    console.log("🟢 [CREATE_INTENT V7] PRICE_CALCULATED", {
      unitPrice: unitPrice.amount,
      quantity,
      subtotal: subtotal.amount,
      shippingFee: shippingFee.amount,
      total: total.amount,
    });

    /* =====================================================
       6. IDENTITY
    ===================================================== */

    const paymentIntentId = safeUUID();
    const nonce = makeNonce();
    const verifyToken = makeVerifyToken();

    const memo = `ORDER-${paymentIntentId.slice(0, 8)}`;

    /* =====================================================
       7. INSERT PAYMENT INTENT
    ===================================================== */

    await client.query(
      `
      INSERT INTO payment_intents (
        id,
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

        nonce,
        verify_token,

        status,
        settlement_state,

        failed_reason,
        manual_review_reason,

        paid_at,
        settled_at,

        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,'PI',
        $12,$13,$14,
        $15,
        $16,$17,
        $18,$19,
        null,null,
        null,null,
        now(),now()
      )
      `,
      [
        paymentIntentId,
        userId,
        product.seller_id,
        productId,
        variantId,
        quantity,

        unitPrice.amount,
        subtotal.amount,
        discount.amount,
        shippingFee.amount,
        total.amount,

        JSON.stringify(shipping),
        country,
        zone,

        product.merchant_wallet,

        nonce,
        verifyToken,

        makeInitialStatus(),
        makeInitialSettlement(),
      ]
    );

    console.log("🟢 [CREATE_INTENT V7] DB_INSERT_OK", {
      paymentIntentId,
      total: total.amount,
      nonce,
    });

    return {
      ok: true,
      payment_intent_id: paymentIntentId,
      amount: Number(total.amount),
      currency: "PI",
      merchant_wallet: product.merchant_wallet || "",
      memo,
      metadata: {
        payment_intent_id: paymentIntentId,
      },
    };
  });
}
