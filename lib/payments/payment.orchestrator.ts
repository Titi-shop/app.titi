import { guardPaymentForReconcile, acquirePaymentSettlementLock } from "@/lib/db/payments.guard";
import {
  auditDuplicateSubmit,
  auditFinalizeDone,
  auditManualReview,
  auditPiCompleted,
  auditPiVerified,
  auditRpcFailed,
  auditRpcVerified,
} from "@/lib/db/payments.audit";

import { verifyPiPaymentForReconcile } from "@/lib/db/payments.verify";
import { verifyRpcPaymentForReconcile } from "@/lib/db/payments.rpc";
import { finalizePaidOrderFromIntent } from "@/lib/db/orders.payment";
import { SettlementLedger } from "@/lib/db/settlement.ledger";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

export type PaymentTriggerSource =
  | "submit"
  | "reconcile"
  | "webhook"
  | "cron";

type RunSettlementParams = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
  userId: string;
  source: PaymentTriggerSource;
};

async function callPiComplete(
  piPaymentId: string,
  txid: string
): Promise<boolean> {
  try {
    const res = await fetch(`${PI_API}/payments/${piPaymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      if (text.includes("already_completed")) {
        console.log("[ORCHESTRATOR] PI_ALREADY_COMPLETED");
        return true;
      }

      console.warn("[ORCHESTRATOR] PI_COMPLETE_FAIL", {
        status: res.status,
        body: text,
      });

      return false;
    }

    console.log("[ORCHESTRATOR] PI_COMPLETE_OK");
    return true;
  } catch (err) {
    console.error("[ORCHESTRATOR] PI_COMPLETE_CRASH", err);
    return false;
  }
}

export async function runPaymentSettlement({
  paymentIntentId,
  piPaymentId,
  txid,
  userId,
  source,
}: RunSettlementParams) {
  console.log("[ORCHESTRATOR] START", {
    paymentIntentId,
    source,
  });

  /* =====================================================
     STEP A — PAYMENT GUARD
  ===================================================== */

  console.log("[ORCHESTRATOR] STEP_A_GUARD");

  const guard = await guardPaymentForReconcile({
    paymentIntentId,
    userId,
  });

  if (!guard.ok) {
    console.warn("[ORCHESTRATOR] GUARD_FAIL", guard.code);

    if (guard.code === "PAYMENT_ALREADY_PAID") {
      await auditDuplicateSubmit(paymentIntentId, {
        source,
        reason: guard.code,
      });

      return {
        ok: true,
        alreadyPaid: true,
        code: guard.code,
      };
    }

    await auditManualReview(paymentIntentId, guard.code, {
      source,
    });

    return {
      ok: false,
      code: guard.code,
    };
  }

  const lock = await acquirePaymentSettlementLock(paymentIntentId);

  if (!lock.ok) {
    console.warn("[ORCHESTRATOR] LOCK_DENIED");

    await auditDuplicateSubmit(paymentIntentId, {
      source,
      reason: "LOCK_DENIED",
    });

    return {
      ok: false,
      code: "LOCK_DENIED",
    };
  }

  /* =====================================================
     STEP B — PI VERIFY (OFFICIAL SOURCE OF TRUTH)
  ===================================================== */

  console.log("[ORCHESTRATOR] STEP_B_PI_VERIFY");

  const piVerified = await verifyPiPaymentForReconcile({
    paymentIntentId,
    piPaymentId,
    userId,
    txid,
  });

  if (!piVerified.ok) {
    await auditManualReview(paymentIntentId, "PI_VERIFY_FAIL", {
      source,
      txid,
    });

    return {
      ok: false,
      code: "PI_VERIFY_FAIL",
    };
  }

  await auditPiVerified(paymentIntentId, {
    amount: piVerified.verifiedAmount,
    receiverWallet: piVerified.receiverWallet,
    txid,
    source,
  });

  /* =====================================================
     STEP C — RPC VERIFY (NON BLOCKING AUDIT)
  ===================================================== */

  console.log("[ORCHESTRATOR] STEP_C_RPC_AUDIT");

  let rpcVerified: any = {
    ok: false,
    audited: false,
    reason: "RPC_SKIPPED",
  };

  try {
    rpcVerified = await verifyRpcPaymentForReconcile({
      paymentIntentId,
      txid,
    });

    if (rpcVerified.ok) {
      await auditRpcVerified(paymentIntentId, {
        amount: rpcVerified.amount,
        sender: rpcVerified.sender,
        receiver: rpcVerified.receiver,
        ledger: rpcVerified.ledger,
      });
    } else {
      await auditRpcFailed(paymentIntentId, {
        reason: rpcVerified.reason,
        ledger: rpcVerified.ledger,
      });
    }
  } catch (err) {
    await auditRpcFailed(paymentIntentId, {
      reason: err instanceof Error ? err.message : String(err),
    });
  }

  /* =====================================================
     STEP D — FINALIZE ORDER ATOMICALLY
  ===================================================== */

  console.log("[ORCHESTRATOR] STEP_D_FINALIZE");

  const paid = await finalizePaidOrderFromIntent({
    paymentIntentId,
    piPaymentId,
    txid,
    verifiedAmount: piVerified.verifiedAmount,
    receiverWallet: piVerified.receiverWallet,
    piPayload: piVerified.piPayload,
    rpcPayload: rpcVerified,
  });

  await auditFinalizeDone(paymentIntentId, {
    orderId: paid.orderId,
    source,
  });

  /* =====================================================
     STEP E — ESCROW LEDGER WRITE
  ===================================================== */

  console.log("[ORCHESTRATOR] STEP_E_LEDGER");

  try {
    const escrow = await SettlementLedger.createEscrow({
      paymentIntentId,
      orderId: paid.orderId,
      buyerId: userId,
      sellerId: "AUTO_FROM_ORDER",
      amount: piVerified.verifiedAmount,
      currency: "PI",
    });

    await SettlementLedger.markPaymentConfirmed({
      escrowId: escrow.id,
      txid,
      source: "PI",
    });

    if (rpcVerified?.ok) {
      await SettlementLedger.markPaymentConfirmed({
        escrowId: escrow.id,
        txid,
        source: "RPC",
      });
    }

    await SettlementLedger.linkOrder({
      escrowId: escrow.id,
      orderId: paid.orderId,
    });
  } catch (err) {
    console.error("[ORCHESTRATOR] ESCROW_LEDGER_FAIL", err);
  }

  /* =====================================================
     STEP F — PI COMPLETE
  ===================================================== */

  console.log("[ORCHESTRATOR] STEP_F_PI_COMPLETE");

  const piCompleted = await callPiComplete(piPaymentId, txid);

  if (piCompleted) {
    await auditPiCompleted(paymentIntentId, {
      piPaymentId,
      txid,
    });
  } else {
    await auditManualReview(paymentIntentId, "PI_COMPLETE_FAILED", {
      piPaymentId,
      txid,
    });
  }

  console.log("[ORCHESTRATOR] DONE");

  return {
    ok: true,
    orderId: paid.orderId,
    piCompleted,
    rpcAudited: rpcVerified?.audited ?? false,
  };
}
