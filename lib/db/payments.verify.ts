import { verifyRpcTx } from "./payments.rpc";

export type VerifyInput = {
  txid: string;
  expectedAmount: number;
  expectedReceiver: string;
  piPaymentId: string;
};

/* =========================
   FULL PAYMENT VERIFY PIPELINE
========================= */

export async function verifyPayment(input: VerifyInput) {
  /* ================= RPC CHECK ================= */

  const rpc = await verifyRpcTx(input.txid);

  if (!rpc.ok) {
    return {
      ok: false,
      reason: "RPC_FAILED"
    };
  }

  /* ================= AMOUNT CHECK ================= */

  if (Number(rpc.amount) !== Number(input.expectedAmount)) {
    return {
      ok: false,
      reason: "AMOUNT_MISMATCH"
    };
  }

  /* ================= RECEIVER CHECK ================= */

  if (rpc.receiver !== input.expectedReceiver) {
    return {
      ok: false,
      reason: "INVALID_RECEIVER"
    };
  }

  /* ================= SUCCESS ================= */

  return {
    ok: true,
    rpc
  };
}
