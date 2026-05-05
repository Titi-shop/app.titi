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

/* =========================================================
   HELPERS
========================================================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function safeQty(v: unknown): number {
  const n = Number(v);

  if (!Number.isInteger(n) || n <= 0) {
    return 1;
  }

  return Math.min(n, 10);
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

  const shipping =
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

  if (!shipping) {
    throw new Error("INVALID_SHIPPING");
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

export async function createPiIntentFromRequest(input: RawInput) {
  const normalized = normalizeCreateIntentInput(input);

  console.log("[PAYMENT][CREATE_INTENT_START]", {
    userId: normalized.userId,
    productId: normalized.productId,
    variantId: normalized.variantId,
    quantity: normalized.quantity,
  });

  const intent = await createPiPaymentIntent(normalized);

  console.log("[PAYMENT][CREATE_INTENT_SUCCESS]", {
    paymentIntentId: intent.payment_intent_id,
  });

  return intent;
}
