
import { withTransaction } from "@/lib/db";
import crypto from "crypto";
import { getShippingRatesByProduct } from "@/lib/db/shipping";

import type {
  PaymentIntentStatus,
  SettlementState,
  Money,
} from "@/lib/payments/payment.types";

/* =========================================================
   GLOBAL APP RECEIVER WALLET
========================================================= */

const APP_MERCHANT_WALLET = (process.env.PI_MERCHANT_WALLET || "").trim();

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
  sold: number;
  is_unlimited: boolean;
  is_digital: boolean;
  price: string;
};

type VariantRow = {
  id: string;
  product_id: string;
  stock: number;
  sold: number;
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
   MONEY HELPERS
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

function moneyMul(a: Money, qty: number): Money {
  return toMoney(Number(a.amount) * qty);
}

/* =========================================================
   ID HELPERS
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
  console.log("🟡 [CREATE_INTENT MASTER] START", {
    userId,
    productId,
    variantId,
    quantity,
    country,
    zone,
  });

  if (!APP_MERCHANT_WALLET) {
    throw new Error("APP_MERCHANT_WALLET_MISSING");
  }

  return withTransaction(async (client) => {
    console.log("🟡 [CREATE_INTENT MASTER] DB_TX_START");

    /* =====================================================
       1. LOCK PRODUCT
    ===================================================== */

    const productRes = await client.query<ProductRow>(
      `
      SELECT id, seller_id, stock, sold, is_unlimited, is_digital, price
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

    console.log("🟢 [CREATE_INTENT MASTER] PRODUCT_LOCKED", {
      productId: product.id,
      sellerId: product.seller_id,
      stock: product.stock,
    });

    /* =====================================================
       2. BLOCK SELF BUY
    ===================================================== */

    if (product.seller_id === userId) {
      throw new Error("SELF_PAYMENT_FORBIDDEN");
    }

    /* =====================================================
       3. LOCK VARIANT / PRICE
    ===================================================== */

    let unitPrice = toMoney(product.price);

    let variantSnapshot: Record<string, unknown> | null = null;

    if (variantId) {
      const vr = await client.query<VariantRow>(
        `
        SELECT id, product_id, stock, sold, is_unlimited, price
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

      if (variant.product_id !== productId) {
        throw new Error("VARIANT_PRODUCT_MISMATCH");
      }

      if (!variant.is_unlimited && variant.stock < quantity) {
        throw new Error("OUT_OF_STOCK");
      }

      unitPrice = toMoney(variant.price);

      variantSnapshot = {
        variant_id: variant.id,
        stock_snapshot: variant.stock,
        sold_snapshot: variant.sold,
        is_unlimited: variant.is_unlimited,
        locked_price: unitPrice.amount,
      };

      console.log("🟢 [CREATE_INTENT MASTER] VARIANT_LOCKED", {
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
       4. SHIPPING CALCULATE
    ===================================================== */

    let shippingFee = toMoney(0);

    if (!product.is_digital) {
      const rates = await getShippingRatesByProduct(productId);

      let matchedPrice: number | null = null;

      const domestic = rates.find(
        (r) =>
          r.zone === "domestic" &&
          r.domesticCountryCode?.toUpperCase() === country.toUpperCase()
      );

      if (zone === "domestic" && domestic) {
        matchedPrice = domestic.price;
      }

      if (matchedPrice === null) {
        const regional = rates.find((r) => r.zone === zone);
        if (regional) matchedPrice = regional.price;
      }

      if (matchedPrice === null) {
        const global = rates.find((r) => r.zone === "rest_of_world");
        if (global) matchedPrice = global.price;
      }

      if (matchedPrice === null) {
        throw new Error("SHIPPING_NOT_AVAILABLE");
      }

      shippingFee = toMoney(matchedPrice);
    }

    console.log("🟢 [CREATE_INTENT MASTER] SHIPPING_OK", {
      shippingFee: shippingFee.amount,
      zone,
    });

    /* =====================================================
       5. MONEY CALCULATE
    ===================================================== */

    const subtotal = moneyMul(unitPrice, quantity);
    const discount = toMoney(0);
    const total = moneyAdd(subtotal, shippingFee);

    console.log("🟢 [CREATE_INTENT MASTER] PRICE_OK", {
      unitPrice: unitPrice.amount,
      subtotal: subtotal.amount,
      shippingFee: shippingFee.amount,
      total: total.amount,
    });

    /* =====================================================
       6. IMMUTABLE SNAPSHOT
    ===================================================== */

    const paymentIntentId = safeUUID();
    const nonce = makeNonce();
    const verifyToken = makeVerifyToken();
    const idempotencyKey = safeUUID();

    const memo = `ORDER-${paymentIntentId.slice(0, 8)}`;

    const shippingSnapshot = {
      buyer_shipping: shipping,
      buyer_country: country,
      buyer_zone: zone,
      charged_shipping_fee: shippingFee.amount,

      commercial_snapshot: {
        quantity,
        locked_unit_price: unitPrice.amount,
        locked_subtotal: subtotal.amount,
        locked_discount: discount.amount,
        locked_total: total.amount,
        product_is_digital: product.is_digital,
        product_stock_snapshot: product.stock,
        product_sold_snapshot: product.sold,
      },

      variant_snapshot: variantSnapshot,
    };

    /* =====================================================
       7. INSERT PAYMENT INTENT
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
        settlement_state
      )
      VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,'PI',
        $15,$16,$17,
        $18,
        $19,$20
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

        JSON.stringify(shippingSnapshot),
        country,
        zone,

        APP_MERCHANT_WALLET,

        makeInitialStatus(),
        makeInitialSettlement(),
      ]
    );

    console.log("🟢 [CREATE_INTENT MASTER] DB_INSERT_OK", {
      paymentIntentId,
      amount: total.amount,
      merchantWallet: APP_MERCHANT_WALLET,
    });

    return {
      ok: true,
      payment_intent_id: paymentIntentId,
      amount: Number(total.amount),
      currency: "PI",
      merchant_wallet: APP_MERCHANT_WALLET,
      memo,
      metadata: {
        payment_intent_id: paymentIntentId,
      },
    };
  });
}
