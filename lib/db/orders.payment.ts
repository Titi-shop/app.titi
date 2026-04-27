import { withTransaction } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

type CreateIntentParams = {
  userId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
};

type CompleteIntentParams = {
  userId: string;
  paymentIntentId: string;
  txid: string;
  rpcAmount: number;
  rpcReceiver: string;
  rpcConfirmedAt: string;
};

type PaymentIntentRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  expected_amount: string;
  shipping_fee: string;
  subtotal: string;
  total: string;
  currency: string;
  merchant_wallet: string;
  nonce: string;
  status: string;

  shipping_name: string;
  shipping_phone: string;
  shipping_address_line: string;
  shipping_ward: string | null;
  shipping_district: string | null;
  shipping_region: string | null;
  shipping_country: string;
  shipping_postal_code: string | null;
  shipping_zone: string;
  created_at: string;
};

/* =========================================================
   HELPERS
========================================================= */

function isUUID(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function safeQty(v: unknown): number {
  const n = Number(v);

  if (!Number.isInteger(n) || n <= 0) {
    return 1;
  }

  if (n > 100) {
    return 100;
  }

  return n;
}

function safeNumber(v: unknown): number {
  const n = Number(v);

  if (Number.isNaN(n)) {
    throw new Error("INVALID_NUMBER");
  }

  return n;
}

function generateNonce(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function getMerchantWallet(): string {
  const wallet = process.env.PI_MERCHANT_WALLET?.trim();

  if (!wallet) {
    throw new Error("MISSING_MERCHANT_WALLET");
  }

  return wallet;
}

/* =========================================================
   SHIPPING ZONE RESOLVE
========================================================= */

async function resolveShipping(
  client: {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount: number | null }>;
  },
  userId: string,
  productId: string
) {
  const addressRes = await client.query<{
    full_name: string;
    phone: string;
    address_line: string;
    ward: string | null;
    district: string | null;
    region: string | null;
    country: string;
    postal_code: string | null;
  }>(
    `
    SELECT
      full_name,
      phone,
      address_line,
      ward,
      district,
      region,
      country,
      postal_code
    FROM addresses
    WHERE user_id = $1
      AND is_default = true
    LIMIT 1
    `,
    [userId]
  );

  if (!addressRes.rows.length) {
    throw new Error("ADDRESS_NOT_FOUND");
  }

  const address = addressRes.rows[0];

  const addressCountry = String(address.country || "")
    .trim()
    .toUpperCase();

  if (!addressCountry) {
    throw new Error("INVALID_COUNTRY");
  }

  const shippingRateCheck = await client.query<{
    zone: string;
    domestic_country_code: string | null;
  }>(
    `
    SELECT
      sz.code AS zone,
      sr.domestic_country_code
    FROM shipping_rates sr
    JOIN shipping_zones sz ON sz.id = sr.zone_id
    WHERE sr.product_id = $1
    `,
    [productId]
  );

  if (!shippingRateCheck.rows.length) {
    throw new Error("SHIPPING_NOT_AVAILABLE");
  }

  let realZone: string | null = null;

  const domestic = shippingRateCheck.rows.find(
    (r) =>
      r.zone === "domestic" &&
      r.domestic_country_code &&
      r.domestic_country_code.trim().toUpperCase() === addressCountry
  );

  if (domestic) {
    realZone = "domestic";
  }

  if (!realZone) {
    const zoneRes = await client.query<{ code: string }>(
      `
      SELECT sz.code
      FROM shipping_zone_countries szc
      JOIN shipping_zones sz ON sz.id = szc.zone_id
      WHERE szc.country_code = $1
      LIMIT 1
      `,
      [addressCountry]
    );

    if (!zoneRes.rows.length) {
      throw new Error("INVALID_COUNTRY");
    }

    realZone = zoneRes.rows[0].code;
  }

  const shippingPriceRes = await client.query<{ price: string }>(
    `
    SELECT sr.price
    FROM shipping_rates sr
    JOIN shipping_zones sz ON sz.id = sr.zone_id
    WHERE sr.product_id = $1
      AND sz.code = $2
    LIMIT 1
    `,
    [productId, realZone]
  );

  if (!shippingPriceRes.rows.length) {
    throw new Error("SHIPPING_NOT_AVAILABLE");
  }

  return {
    address,
    zone: realZone,
    shippingFee: safeNumber(shippingPriceRes.rows[0].price),
  };
}

/* =========================================================
   PRODUCT SNAPSHOT
========================================================= */

async function resolveProduct(
  client: {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount: number | null }>;
  },
  productId: string,
  variantId: string | null,
  quantity: number
) {
  const productRes = await client.query<{
    id: string;
    seller_id: string;
    name: string;
    price: string;
    thumbnail: string | null;
    sale_price: string | null;
    sale_start: string | null;
    sale_end: string | null;
    is_active: boolean;
    deleted_at: string | null;
    stock: number;
  }>(
    `
    SELECT
      id,
      seller_id,
      name,
      price,
      thumbnail,
      sale_price,
      sale_start,
      sale_end,
      is_active,
      deleted_at,
      stock
    FROM products
    WHERE id = $1
    LIMIT 1
    `,
    [productId]
  );

  if (!productRes.rows.length) {
    throw new Error("PRODUCT_NOT_AVAILABLE");
  }

  const product = productRes.rows[0];

  if (product.is_active === false || product.deleted_at) {
    throw new Error("PRODUCT_NOT_AVAILABLE");
  }

  if (!isUUID(product.seller_id)) {
    throw new Error("INVALID_SELLER");
  }

  let unitPrice = safeNumber(product.price);

  if (variantId) {
    const vRes = await client.query<{
      price: string;
      sale_price: string | null;
      stock: number;
    }>(
      `
      SELECT price, sale_price, stock
      FROM product_variants
      WHERE id = $1
        AND product_id = $2
      LIMIT 1
      `,
      [variantId, productId]
    );

    if (!vRes.rows.length) {
      throw new Error("INVALID_VARIANT");
    }

    const variant = vRes.rows[0];

    if (variant.stock < quantity) {
      throw new Error("OUT_OF_STOCK");
    }

    unitPrice =
      variant.sale_price && safeNumber(variant.sale_price) > 0
        ? safeNumber(variant.sale_price)
        : safeNumber(variant.price);

  } else {
    if (product.stock < quantity) {
      throw new Error("OUT_OF_STOCK");
    }

    const now = Date.now();
    const start = product.sale_start ? new Date(product.sale_start).getTime() : null;
    const end = product.sale_end ? new Date(product.sale_end).getTime() : null;

    const isSale =
      product.sale_price !== null &&
      safeNumber(product.sale_price) > 0 &&
      start !== null &&
      end !== null &&
      now >= start &&
      now <= end;

    unitPrice = isSale
      ? safeNumber(product.sale_price)
      : safeNumber(product.price);
  }

  return {
    product,
    unitPrice,
    subtotal: unitPrice * quantity,
  };
}

/* =========================================================
   CREATE PAYMENT INTENT
========================================================= */

export async function createPaymentIntent(params: CreateIntentParams) {
  if (!isUUID(params.userId)) throw new Error("INVALID_USER_ID");
  if (!isUUID(params.productId)) throw new Error("INVALID_PRODUCT_ID");

  const variantId =
    params.variantId && isUUID(params.variantId)
      ? params.variantId
      : null;

  const quantity = safeQty(params.quantity);

  return withTransaction(async (client) => {
    const shipping = await resolveShipping(client, params.userId, params.productId);
    const productData = await resolveProduct(client, params.productId, variantId, quantity);

    const discount = 0;
    const itemsTotal = productData.subtotal - discount;
    const total = itemsTotal + shipping.shippingFee;

    const merchantWallet = getMerchantWallet();
    const nonce = generateNonce();

    const insert = await client.query<{ id: string }>(
      `
      INSERT INTO pi_payment_intents (
        buyer_id,
        seller_id,
        product_id,
        variant_id,
        quantity,

        subtotal,
        shipping_fee,
        discount,
        total,
        expected_amount,
        currency,

        merchant_wallet,
        nonce,

        shipping_name,
        shipping_phone,
        shipping_address_line,
        shipping_ward,
        shipping_district,
        shipping_region,
        shipping_country,
        shipping_postal_code,
        shipping_zone,

        status
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,$11,
        $12,$13,
        $14,$15,$16,$17,$18,$19,$20,$21,$22,
        'pending'
      )
      RETURNING id
      `,
      [
        params.userId,
        productData.product.seller_id,
        params.productId,
        variantId,
        quantity,

        productData.subtotal,
        shipping.shippingFee,
        discount,
        total,
        total,
        "PI",

        merchantWallet,
        nonce,

        shipping.address.full_name,
        shipping.address.phone,
        shipping.address.address_line,
        shipping.address.ward ?? null,
        shipping.address.district ?? null,
        shipping.address.region ?? null,
        shipping.address.country,
        shipping.address.postal_code ?? null,
        shipping.zone,
      ]
    );

    return {
      paymentIntentId: insert.rows[0].id,
      amount: total,
      merchantWallet,
      nonce,
      currency: "PI",
    };
  });
}
