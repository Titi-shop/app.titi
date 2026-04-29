import { query } from "@/lib/db";

type VerifyPiPaymentForReconcileParams = {
  paymentIntentId: string;
  userId: string;
  piPaymentId: string;
};

export type VerifiedPiPaymentIntent = {
  paymentIntentId: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  lockedAmount: number;
  merchantWallet: string;
  status: string;
};

export async function verifyPiPaymentForReconcile({
  paymentIntentId,
  userId,
  piPaymentId,
}: VerifyPiPaymentForReconcileParams): Promise<VerifiedPiPaymentIntent> {
  console.log("🟡 [DB_VERIFY] verifyPiPaymentForReconcile START", {
    paymentIntentId,
    userId,
  });

  const result = await query<{
    id: string;
    buyer_id: string;
    seller_id: string;
    product_id: string;
    variant_id: string | null;
    quantity: number;
    total_amount: number;
    merchant_wallet: string;
    status: string;
    pi_payment_id: string | null;
  }>(
    `
    SELECT
      id,
      buyer_id,
      seller_id,
      product_id,
      variant_id,
      quantity,
      total_amount,
      merchant_wallet,
      status,
      pi_payment_id
    FROM payment_intents
    WHERE id = $1
    LIMIT 1
    `,
    [paymentIntentId]
  );

  if (!result.rows.length) {
    throw new Error("PAYMENT_INTENT_NOT_FOUND");
  }

  const row = result.rows[0];

  if (row.buyer_id !== userId) {
    throw new Error("FORBIDDEN");
  }

  if (!row.pi_payment_id || row.pi_payment_id !== piPaymentId) {
    throw new Error("PI_PAYMENT_NOT_BOUND");
  }

  if (row.status === "paid") {
    return {
      paymentIntentId: row.id,
      buyerId: row.buyer_id,
      sellerId: row.seller_id,
      productId: row.product_id,
      variantId: row.variant_id,
      quantity: row.quantity,
      lockedAmount: Number(row.total_amount),
      merchantWallet: row.merchant_wallet,
      status: row.status,
    };
  }

  if (row.status !== "verifying") {
    throw new Error("INVALID_PAYMENT_STATUS");
  }

  return {
    paymentIntentId: row.id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    productId: row.product_id,
    variantId: row.variant_id,
    quantity: row.quantity,
    lockedAmount: Number(row.total_amount),
    merchantWallet: row.merchant_wallet,
    status: row.status,
  };
}
