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
  // 👉 MOVE ENTIRE LOGIC FROM ROUTE HERE

  const piVerified = await verifyPiPaymentForReconcile(...);
  const rpcVerified = await verifyRpcPaymentForReconcile(...);

  if (!piVerified.ok) throw new Error("PI_NOT_VERIFIED");
  if (!rpcVerified.ok) throw new Error("RPC_NOT_VERIFIED");

  const paid = await finalizePaidOrderFromIntent(...);

  await callPiComplete(piPaymentId, txid);

  return {
    success: true,
    order_id: paid.orderId,
    amount: piVerified.verifiedAmount,
  };
}
