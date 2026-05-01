import { verifyPiPaymentForReconcile } from "@/lib/db/payments.verify";
import { verifyRpcPaymentForReconcile } from "@/lib/db/payments.rpc";
import { finalizePaidOrderFromIntent } from "@/lib/db/orders.payment";

type Params = {
  userId: string;
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
};

export async function reconcilePayment({
  userId,
  paymentIntentId,
  piPaymentId,
  txid,
}: Params) {
  console.log("[RECONCILE][SERVICE] START");

  /* =========================
     STEP 1: PI VERIFY
  ========================= */

  const piVerified = await verifyPiPaymentForReconcile({
    paymentIntentId,
    piPaymentId,
    userId,
    txid,
  });

  if (!piVerified.ok) {
    throw new Error("PI_NOT_VERIFIED");
  }

  console.log("[RECONCILE][SERVICE] PI_OK");

  /* =========================
     STEP 2: RPC VERIFY
  ========================= */

  const rpcVerified = await verifyRpcPaymentForReconcile({
    paymentIntentId,
    txid,
  });

  if (!rpcVerified.ok) {
    throw new Error(rpcVerified.reason || "RPC_NOT_VERIFIED");
  }

  console.log("[RECONCILE][SERVICE] RPC_OK");

  /* =========================
     STEP 3: FINALIZE ORDER
  ========================= */

  const paid = await finalizePaidOrderFromIntent({
    paymentIntentId,
    piPaymentId,
    txid,
    verifiedAmount: piVerified.verifiedAmount,
    receiverWallet: piVerified.receiverWallet,
    piPayload: piVerified.piPayload,
    rpcPayload: rpcVerified,
    userId,
  });

  console.log("[RECONCILE][SERVICE] ORDER_PAID", paid.orderId);

  return {
    success: true,
    order_id: paid.orderId,
    amount: piVerified.verifiedAmount,
  };
}
