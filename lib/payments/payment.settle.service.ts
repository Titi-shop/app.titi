import { submitPiPaymentFromRequest } from "./payment.submit.service";
import { runPaymentSettlement } from "@/lib/payments/payment.orchestrator";
import { getPaymentIntent } from "@/lib/db/payments.intent";

type Input = {
  raw: any;
  userId: string;
  requestId: string;
};

export async function settlePiPayment({
  raw,
  userId,
  requestId,
}: Input) {
  /**
   * 1. Submit step (idempotent, không side-effect settlement)
   */
  await submitPiPaymentFromRequest({
    raw,
    userId,
    requestId,
  });

  /**
   * 2. Extract data safely
   */
  const paymentIntentId = raw?.payment_intent_id;
  const piPaymentId = raw?.pi_payment_id;
  const txid = raw?.txid;

  if (!paymentIntentId || !piPaymentId || !txid) {
    throw new Error("INVALID_SETTLEMENT_INPUT");
  }

  /**
   * 3. Load intent (SERVICE layer allowed, NOT orchestrator)
   */
  const intent = await getPaymentIntent(paymentIntentId);

  if (!intent) {
    throw new Error("INTENT_NOT_FOUND");
  }

  /**
   * 4. Call CORE orchestrator (correct V7 boundary)
   */
  const result = await runPaymentSettlement({
    paymentIntentId,
    piPaymentId,
    txid,
    userId,
    source: "submit-api",
    intent, // 👈 inject dependency
  });

  if (!result.ok) {
    throw new Error("SETTLEMENT_FAILED");
  }

  return {
    success: result.ok,
    requestId,
    order_id: result.orderId,
    amount: result.amount,
    pi_completed: result.piCompleted,
    rpc_audited: result.rpcAudited,
    source: result.source,
  };
}
