import { withTransaction } from "@/lib/db";

/* =========================
   TYPES
========================= */

type ShippingInput = {
  name: string;
  phone: string;
  address_line: string;
  ward?: string | null;
  district?: string | null;
  region?: string | null;
  postal_code?: string | null;
};

type CreateIntentParams = {
  userId: string; // buyerId (UUID after auth mapping)
  productId: string;
  variantId?: string | null;
  quantity: number;
  country: string;
  zone: string;
  shipping: ShippingInput;
};

type CreateIntentResult = {
  paymentIntentId: string;
  amount: number;
  merchantWallet: string;
  nonce: string;
  currency: "PI";
};

/* =========================
   HELPERS
========================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function safeQty(v: number): number {
  if (!Number.isInteger(v) || v <= 0) return 1;
  if (v > 100) return 100;
  return v;
}

function getMerchantWallet(): string {
  const w = process.env.PI_MERCHANT_WALLET;
  if (!w) throw new Error("MISSING_MERCHANT_WALLET");
  return w.trim();
}

function generateNonce(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/* =========================
   MAIN
========================= */

export async function createPiPaymentIntent(
  params: CreateIntentParams
): Promise<CreateIntentResult> {
  if (!isUUID(params.userId)) throw new Error("INVALID_USER_ID");
  if (!isUUID(params.productId)) throw new Error("INVALID_PRODUCT_ID");

  const variantId =
    params.variantId && isUUID(params.variantId)
      ? params.variantId
      : null;

  const quantity = safeQty(params.quantity);
  const merchantWallet = getMerchantWallet();
  const nonce = generateNonce();

  return withTransaction(async (client) => {
    console.log("🟡 [PAYMENT_INTENT] START", {
      buyerId: params.userId,
      productId: params.productId,
    });

    /* =========================
       1. PRODUCT
    ========================= */

    const productRes = await client.query<{
      id: string;
      seller_id: string;
      price: string;
      sale_price: string | null;
      stock: number;
    }>(
      `
      SELECT id, seller_id, price, sale_price, stock
      FROM products
      WHERE id = $1
      LIMIT 1
      `,
      [params.productId]
    );

    if (!productRes.rows.length) throw new Error("PRODUCT_NOT_FOUND");

    const product = productRes.rows[0];

    let unitPrice = Number(product.price);

    /* =========================
       2. VARIANT
    ========================= */

    if (variantId) {
      const v = await client.query<{
        price: string;
        sale_price: string | null;
        stock: number;
      }>(
        `
        SELECT price, sale_price, stock
        FROM product_variants
        WHERE id = $1 AND product_id = $2
        LIMIT 1
        `,
        [variantId, params.productId]
      );

      if (!v.rows.length) throw new Error("INVALID_VARIANT");

      const variant = v.rows[0];

      if (variant.stock < quantity) throw new Error("OUT_OF_STOCK");

      unitPrice =
        variant.sale_price && Number(variant.sale_price) > 0
          ? Number(variant.sale_price)
          : Number(variant.price);
    } else {
      if (product.stock < quantity) throw new Error("OUT_OF_STOCK");
    }

    /* =========================
       3. SHIPPING RATE
    ========================= */

    const ship = await client.query<{ price: string }>(
      `
      SELECT sr.price
      FROM shipping_rates sr
      JOIN shipping_zones sz ON sz.id = sr.zone_id
      WHERE sr.product_id = $1 AND sz.code = $2
      LIMIT 1
      `,
      [params.productId, params.zone]
    );

    if (!ship.rows.length) throw new Error("SHIPPING_NOT_AVAILABLE");

    const shippingFee = Number(ship.rows[0].price);

    /* =========================
       4. TOTAL CALC
    ========================= */

    const subtotal = unitPrice * quantity;
    const total = subtotal + shippingFee;

    if (!Number.isFinite(total) || total <= 0) {
      throw new Error("INVALID_TOTAL");
    }

    /* =========================
       5. SHIPPING SNAPSHOT (FIXED)
    ========================= */

    const shipping_snapshot = {
      name: params.shipping.name,
      phone: params.shipping.phone,
      address_line: params.shipping.address_line,
      ward: params.shipping.ward ?? null,
      district: params.shipping.district ?? null,
      region: params.shipping.region ?? null,
      postal_code: params.shipping.postal_code ?? null,
      country: params.country,
      zone: params.zone,
    };

    /* =========================
       6. INSERT INTENT (FIXED SQL)
    ========================= */

    const insert = await client.query<{ id: string }>(
      `
      INSERT INTO payment_intents (
        buyer_id,
        seller_id,
        product_id,
        variant_id,
        quantity,

        unit_price,
        subtotal,
        shipping_fee,
        total_amount,
        currency,

        shipping_snapshot,

        country,
        zone,

        merchant_wallet,
        nonce,
        status
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11,
        $12,$13,
        $14,$15,'created'
      )
      RETURNING id
      `,
      [
        params.userId,       // buyer_id
        product.seller_id,   // seller_id
        params.productId,
        variantId,
        quantity,

        unitPrice,
        subtotal,
        shippingFee,
        total,
        "PI",

        JSON.stringify(shipping_snapshot),

        params.country,
        params.zone,

        merchantWallet,
        nonce,
      ]
    );

    console.log("🟢 [PAYMENT_INTENT] CREATED", insert.rows[0].id);

    return {
  paymentIntentId: String(paymentIntentId),
  amount: Number(total),
  memo: `ORDER-${String(paymentIntentId).slice(0, 8)}`,
  metadata: {
    paymentIntentId,
    nonce,

      currency: "PI",
    };
  });
}
