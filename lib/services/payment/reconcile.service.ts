import { verifyPiPaymentForReconcile } from "@/lib/db/payments.verify";
import { verifyRpcPaymentForReconcile } from "@/lib/db/payments.rpc";
import { finalizePaidOrderFromIntent } from "@/lib/db/orders.payment";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

async function callPiComplete(piPaymentId: string, txid: string) {
  try {
    const res = await fetch(`${PI_API}/payments/${piPaymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
    });

    const text = await res.text();

    if (!res.ok) {
      if (text.includes("already_completed")) return true;
      return false;
    }

    return true;
  } catch (err) {
    console.error("🔥 PI_COMPLETE_FAIL", err);
    return false;
  }
}

export async function reconcilePayment({
  userId,
  paymentIntentId,
  piPaymentId,
  txid,
}: any) {
  console.log("[RECONCILE] START");

  /* STEP 1 */
  const piVerified = await verifyPiPaymentForReconcile({
    paymentIntentId,
    piPaymentId,
    userId,
    txid,
  });

  if (!piVerified.ok) throw new Error("PI_NOT_VERIFIED");

  /* STEP 2 */
  const rpcVerified = await verifyRpcPaymentForReconcile({
    paymentIntentId,
    txid,
  });

  if (!rpcVerified.ok) throw new Error("RPC_NOT_VERIFIED");

  /* STEP 3 - FINALIZE ORDER */
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

  console.log("[RECONCILE] ORDER_PAID", paid.orderId);

  /* STEP 4 - 🔥 CRITICAL: COMPLETE PI */
  const completed = await callPiComplete(piPaymentId, txid);

  if (!completed) {
    console.error("[RECONCILE] PI_COMPLETE_FAILED");
    throw new Error("PI_COMPLETE_FAILED");
  }

  console.log("[RECONCILE] DONE");

  return {
    success: true,
    order_id: paid.orderId,
  };
}
