
import { withTransaction } from "@/lib/db";
import crypto from "crypto";
import {
  getShippingRatesByProduct,
  getZoneByCountry,
} from "@/lib/db/shipping";

import type {
  PaymentIntentStatus,
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
  stock: number;
  is_unlimited: boolean;
  is_digital: boolean;
  price: string;
  merchant_wallet: string | null;
};

type VariantRow = {
  id: string;
  stock: number;
  is_unlimited: boolean;
  price: string;
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
  if (!Number.isFinite(v)) throw new Error("INVALID_MONEY");

  return {
    amount: v.toFixed(7),
    currency: "PI",
  };
}

function moneyAdd(a: Money, b: Money): Money {
  return toMoney(Number(a.amount) + Number(b.amount));
}

function safeUUID() {
  return crypto.randomUUID();
}

function makeNonce() {
  return crypto.randomBytes(16).toString("hex");
}

function makeVerifyToken() {
  return crypto.randomBytes(20).toString("hex");
}

function makeIdempotencyKey() {
  return crypto.randomBytes(24).toString("hex");
}

function makeInitialStatus(): PaymentIntentStatus {
  return "created";
}

function chooseShippingPrice(params: {
  rates: Awaited<ReturnType<typeof getShippingRatesByProduct>>;
  buyerCountry: string;
  buyerZone: string | null;
}): number {
  const { rates, buyerCountry, buyerZone } = params;

  const domestic = rates.find(
    (r) =>
      r.zone === "domestic" &&
      (r.domesticCountryCode || "").toUpperCase() === buyerCountry
  );

  if (domestic) return Number(domestic.price);

  if (buyerZone) {
    const regional = rates.find((r) => r.zone === buyerZone);
    if (regional) return Number(regional.price);
  }

  const global = rates.find((r) => r.zone === "rest_of_world");
  if (global) return Number(global.price);

  throw new Error("SHIPPING_NOT_AVAILABLE");
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
       PRODUCT LOCK
    ===================================================== */

    const productRes = await client.query<ProductRow>(
      `SELECT * FROM products WHERE id = $1 FOR UPDATE`,
      [productId]
    );

    if (!productRes.rows.length) throw new Error("PRODUCT_NOT_FOUND");

    const product = productRes.rows[0];

    console.log("🟢 [CREATE_INTENT V7] PRODUCT_LOCKED", {
      productId: product.id,
      sellerId: product.seller_id,
      stock: product.stock,
    });

    if (product.seller_id === userId) {
      throw new Error("SELF_PAYMENT_FORBIDDEN");
    }

    /* =====================================================
       VARIANT LOCK
    ===================================================== */

    let unitPrice = toMoney(product.price);

    if (variantId) {
      const vr = await client.query<VariantRow>(
        `SELECT * FROM product_variants WHERE id = $1 FOR UPDATE`,
        [variantId]
      );

      if (!vr.rows.length) throw new Error("VARIANT_NOT_FOUND");

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
       SHIPPING RESOLVE (SYNC WITH PREVIEW)
    ===================================================== */

    let shippingFee = toMoney(0);

    if (!product.is_digital) {
      const buyerCountry = country.trim().toUpperCase();
      const buyerZone = await getZoneByCountry(buyerCountry);
      const rates = await getShippingRatesByProduct(productId);

      shippingFee = toMoney(
        chooseShippingPrice({
          rates,
          buyerCountry,
          buyerZone,
        })
      );
    }

    console.log("🟢 [CREATE_INTENT V7] SHIPPING_OK", {
      shippingFee: shippingFee.amount,
    });

    /* =====================================================
       MONEY
    ===================================================== */

    const subtotal = toMoney(Number(unitPrice.amount) * quantity);
    const discount = toMoney(0);
    const total = moneyAdd(moneyAdd(subtotal, shippingFee), discount);

    /* =====================================================
       IDENTITY
    ===================================================== */

    const paymentIntentId = safeUUID();
    const nonce = makeNonce();
    const verifyToken = makeVerifyToken();
    const idempotencyKey = makeIdempotencyKey();

    const memo = `ORDER-${paymentIntentId.slice(0, 8)}`;

    /* =====================================================
       INSERT
    ===================================================== */

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

        failed_reason,
        manual_review_reason,

        paid_at,
        settled_at,

        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,'PI',
        $15,$16,$17,
        $18,
        'created','UNSETTLED',
        null,null,
        null,null,
        now(),now()
      )
      `,
      [
        paymentIntentId,
        nonce,
        idempotencyKey,
        verifyToken,

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
      ]
    );

    console.log("🟢 [CREATE_INTENT V7] DB_INSERT_OK", {
      paymentIntentId,
      total: total.amount,
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
