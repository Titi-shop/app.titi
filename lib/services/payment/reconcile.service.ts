export async function reconcilePayment({
  userId,
  paymentIntentId,
  piPaymentId,
  txid,
}: {
  userId: string;
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
}) {
  // TODO: move logic từ route reconcile sang đây

  console.log("[RECONCILE][SERVICE] START", {
    userId,
    paymentIntentId,
    txid,
  });

  return {
    success: true,
    order_id: paymentIntentId,
  };
}
