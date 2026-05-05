import { createPiPaymentIntent } from "@/lib/db/payments.intent";

/* =========================================================
   TYPES
========================================================= */

type RawInput = {
  userId: string;
  raw: unknown;
};

type ShippingInput = {
  name: string;
  phone: string;
  address_line: string;
  ward?: string | null;
  district?: string | null;
  region?: string | null;
  postal_code?: string | null;
};

type NormalizedIntentInput = {
  userId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  country: string;
  zone: string;
  shipping: ShippingInput;
};

type CreateIntentServiceResult = {
  payment_intent_id: string;
  pi_payment_id: string;
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
  to_address: string;
};

/* =========================================================
   HELPERS
========================================================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

function safeQty(v: unknown): number {
  const n = Number(v);

  if (!Number.isInteger(n) || n <= 0) {
    return 1;
  }

  return Math.min(n, 10);
}

function normalizeShipping(raw: ShippingInput): ShippingInput {
  return {
    name: typeof raw.name === "string" ? raw.name.trim() : "",
    phone: typeof raw.phone === "string" ? raw.phone.trim() : "",
    address_line:
      typeof raw.address_line === "string" ? raw.address_line.trim() : "",
    ward: typeof raw.ward === "string" ? raw.ward.trim() : null,
    district: typeof raw.district === "string" ? raw.district.trim() : null,
    region: typeof raw.region === "string" ? raw.region.trim() : null,
    postal_code:
      typeof raw.postal_code === "string" ? raw.postal_code.trim() : null,
  };
}

function normalizeCreateIntentInput({
  userId,
  raw,
}: RawInput): NormalizedIntentInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("INVALID_BODY");
  }

  const body = raw as Record<string, unknown>;

  const productId =
    typeof body.product_id === "string"
      ? body.product_id.trim()
      : "";

  const variantId =
    typeof body.variant_id === "string" && body.variant_id.trim()
      ? body.variant_id.trim()
      : null;

  const quantity = safeQty(body.quantity);

  const country =
    typeof body.country === "string"
      ? body.country.trim().toUpperCase()
      : "";

  const zone =
    typeof body.zone === "string"
      ? body.zone.trim()
      : "";

  const shippingRaw =
    body.shipping && typeof body.shipping === "object"
      ? (body.shipping as ShippingInput)
      : null;

  if (!isUUID(productId)) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  if (variantId && !isUUID(variantId)) {
    throw new Error("INVALID_VARIANT_ID");
  }

  if (!country) {
    throw new Error("INVALID_COUNTRY");
  }

  if (!zone) {
    throw new Error("INVALID_ZONE");
  }

  if (!shippingRaw) {
    throw new Error("INVALID_SHIPPING");
  }

  const shipping = normalizeShipping(shippingRaw);

  if (!shipping.name || !shipping.phone || !shipping.address_line) {
    throw new Error("INCOMPLETE_SHIPPING");
  }

  return {
    userId,
    productId,
    variantId,
    quantity,
    country,
    zone,
    shipping,
  };
}

/* =========================================================
   MAIN SERVICE
========================================================= */

export async function createPiIntentFromRequest({
  userId,
  raw,
}: RawInput): Promise<CreateIntentServiceResult> {
  const normalized = normalizeCreateIntentInput({
    userId,
    raw,
  });

  console.log("[PAYMENT][CREATE_INTENT_START]", {
    userId: normalized.userId,
    productId: normalized.productId,
    variantId: normalized.variantId,
    quantity: normalized.quantity,
    country: normalized.country,
    zone: normalized.zone,
  });

  const dbResult = await createPiPaymentIntent(normalized);

  const paymentIntentId =
    (dbResult as any).payment_intent_id ??
    (dbResult as any).paymentIntentId ??
    (dbResult as any).id;

  if (!paymentIntentId) {
    throw new Error("CREATE_INTENT_RETURN_INVALID");
  }

  const result: CreateIntentServiceResult = {
    payment_intent_id: paymentIntentId,
    pi_payment_id:
      (dbResult as any).pi_payment_id ??
      (dbResult as any).paymentId ??
      "",
    amount: Number((dbResult as any).amount ?? 0),
    memo: String((dbResult as any).memo ?? ""),
    metadata:
      typeof (dbResult as any).metadata === "object" &&
      (dbResult as any).metadata !== null
        ? (dbResult as any).metadata
        : {},
    to_address: String(
      (dbResult as any).to_address ??
      (dbResult as any).merchant_wallet ??
      ""
    ),
  };

  console.log("[PAYMENT][CREATE_INTENT_SUCCESS]", {
    paymentIntentId: result.payment_intent_id,
    piPaymentId: result.pi_payment_id,
    amount: result.amount,
  });

  return result;
}
