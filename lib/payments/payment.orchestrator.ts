


import {
  guardPaymentForReconcile,
  acquirePaymentSettlementLock,
} from "@/lib/db/payments.guard";

import {
  auditDuplicateSubmit,
  auditFinalizeDone,
  auditManualReview,
  auditPiCompleted,
  auditPiVerified,
  auditRpcVerified,
} from "@/lib/db/payments.audit";

import { verifyPiPaymentForReconcile } from "@/lib/db/payments.verify";
import { verifyRpcPaymentForReconcile } from "@/lib/db/payments.rpc";
import { finalizePaidOrderFromIntent } from "@/lib/db/orders.payment";
import { SettlementLedgerV3 as SettlementLedger } from "@/lib/db/settlement.ledger";
import { piCompletePayment } from "@/lib/pi/client";

import type {
  RunPaymentSettlementInput,
  PaymentSettlementResult,
  RpcAuditResult,
} from "@/lib/payments/payment.types";

/* =========================================================
   EMPTY RPC
========================================================= */

function emptyRpc(): RpcAuditResult {
  return {
    ok: false,
    audited: false,
    amount: null,
    sender: null,
    receiver: null,
    ledger: null,
    confirmed: false,
    chainReference: null,
    stage: "UNSET",
    reason: "NOT_EXECUTED",
    payload: {},
  };
}

/* =========================================================
   RESULT BUILDERS
========================================================= */

function failResult(
  amount: number,
  rpcAudited: boolean,
  source: string
): PaymentSettlementResult {
  return {
    ok: false,
    orderId: null,
    amount,
    piCompleted: false,
    rpcAudited,
    source,
  };
}

function successResult(
  orderId: string | null,
  amount: number,
  rpcAudited: boolean,
  source: string
): PaymentSettlementResult {
  return {
    ok: true,
    orderId,
    amount,
    piCompleted: true,
    rpcAudited,
    source,
  };
}

/* =========================================================
   SAFE RPC AUDIT
========================================================= */

async function safeAuditRpc(
  paymentIntentId: string,
  txid: string,
  source: string
): Promise<RpcAuditResult> {
  try {
    const rpc = await verifyRpcPaymentForReconcile({
      paymentIntentId,
      txid,
    });

    if (rpc.ok) {
      await auditRpcVerified(paymentIntentId, {
        source,
        txid,
        amount: rpc.amount,
      });
    }

    return rpc;
  } catch (e) {
    console.warn("[PAYMENT][RPC_VERIFY_FAIL]", e);
    return emptyRpc();
  }
}

/* =========================================================
   SAFE PI COMPLETE
========================================================= */

async function safeCompletePi(
  paymentIntentId: string,
  piPaymentId: string,
  txid: string,
  source: string
): Promise<boolean> {
  try {
    await piCompletePayment(piPaymentId, txid);

    await auditPiCompleted(paymentIntentId, {
      source,
      piPaymentId,
      txid,
    });

    return true;
  } catch {
    await auditManualReview(paymentIntentId, "PI_COMPLETE_FAILED", {
      source,
      txid,
    });

    return false;
  }
}

/* =========================================================
   SAFE LEDGER
========================================================= */

async function safeLedger(
  paid: {
    orderId: string | null;
    buyerId: string;
    sellerId: string;
  },
  paymentIntentId: string,
  piPaymentId: string,
  txid: string,
  amount: number,
  rpcVerified: RpcAuditResult
): Promise<void> {
  try {
    if (!paid.orderId) return;

    const escrowId = await SettlementLedger.createEscrow({
      paymentIntentId,
      orderId: paid.orderId,
      buyerId: paid.buyerId,
      sellerId: paid.sellerId,
      amount,
      txid,
      piPaymentId,
    });

    await SettlementLedger.markPiVerified(escrowId);

    if (rpcVerified.ok) {
      await SettlementLedger.markRpcVerified(escrowId);
    }

    await SettlementLedger.linkOrder(escrowId, paid.orderId);

    await SettlementLedger.creditSeller({
      escrowId,
      sellerId: paid.sellerId,
      amount,
    });

    await SettlementLedger.releaseEscrow(escrowId);
  } catch (e) {
    console.error("[PAYMENT][LEDGER_FAIL]", e);
  }
}

/* =========================================================
   MAIN ORCHESTRATOR
========================================================= */

export async function runPaymentSettlement({
  paymentIntentId,
  piPaymentId,
  txid,
  userId,
  source,
}: RunPaymentSettlementInput): Promise<PaymentSettlementResult> {
  console.log("[PAYMENT][SETTLEMENT_START]", {
    paymentIntentId,
    piPaymentId,
    txid,
    source,
  });

  const guard = await guardPaymentForReconcile({
    paymentIntentId,
    userId: userId ?? "",
  });

  if (!guard.ok) {
    if (guard.code === "PAYMENT_ALREADY_PAID") {
      await auditDuplicateSubmit(paymentIntentId, {
        source,
        reason: "PAYMENT_ALREADY_PAID",
      });

      return successResult(
        guard.orderId ?? null,
        guard.amount ?? 0,
        true,
        source
      );
    }

    await auditManualReview(paymentIntentId, guard.code, { source });
    return failResult(0, false, source);
  }

  const piVerified = await verifyPiPaymentForReconcile({
    paymentIntentId,
    piPaymentId,
    userId: userId ?? "",
    txid,
  });

  if (!piVerified.ok) {
    await auditManualReview(paymentIntentId, "PI_VERIFY_FAIL", {
      source,
      txid,
    });

    return failResult(0, false, source);
  }

  await auditPiVerified(paymentIntentId, {
    source,
    txid,
    amount: piVerified.verifiedAmount,
    receiverWallet: piVerified.receiverWallet,
  });

  const lock = await acquirePaymentSettlementLock(paymentIntentId);

  if (!lock.ok) {
    await auditDuplicateSubmit(paymentIntentId, {
      source,
      reason: "LOCK_DENIED",
    });

    return failResult(piVerified.verifiedAmount, false, source);
  }

  const rpcVerified = await safeAuditRpc(paymentIntentId, txid, source);

  const piCompleted = await safeCompletePi(
    paymentIntentId,
    piPaymentId,
    txid,
    source
  );

  if (!piCompleted) {
    return failResult(piVerified.verifiedAmount, rpcVerified.ok, source);
  }

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
    source,
    orderId: paid.orderId,
  });

  await safeLedger(
    paid,
    paymentIntentId,
    piPaymentId,
    txid,
    piVerified.verifiedAmount,
    rpcVerified
  );

  console.log("[PAYMENT][SETTLEMENT_SUCCESS]", {
    orderId: paid.orderId,
    amount: piVerified.verifiedAmount,
  });

  return successResult(
    paid.orderId,
    piVerified.verifiedAmount,
    rpcVerified.ok,
    source
  );
}
type ReconcileRequestBody = {
  payment_intent_id?: unknown;
  pi_payment_id?: unknown;
  txid?: unknown;
};

function parseReconcileRequestBody(raw: ReconcileRequestBody): {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
} | null {
  const paymentIntentId =
    typeof raw.payment_intent_id === "string"
      ? raw.payment_intent_id.trim()
      : "";

  const piPaymentId =
    typeof raw.pi_payment_id === "string"
      ? raw.pi_payment_id.trim()
      : "";

  const txid =
    typeof raw.txid === "string"
      ? raw.txid.trim()
      : "";

  if (!paymentIntentId || !piPaymentId || !txid) {
    return null;
  }

  return {
    paymentIntentId,
    piPaymentId,
    txid,
  };
}

export async function runPaymentSettlementFromRequest(input: {
  rawBody: unknown;
  userId: string;
}): Promise<PaymentSettlementResult | null> {
  if (!input.rawBody || typeof input.rawBody !== "object") {
    return null;
  }

  const parsed = parseReconcileRequestBody(
    input.rawBody as ReconcileRequestBody
  );

  if (!parsed) {
    return null;
  }

  return runPaymentSettlement({
    paymentIntentId: parsed.paymentIntentId,
    piPaymentId: parsed.piPaymentId,
    txid: parsed.txid,
    userId: input.userId,
    source: "reconcile-api",
  });
}
2) lib/db/payments.guard.ts

import { query } from "@/lib/db";
import type {
  GuardPaymentResult,
  PaymentLockResult,
} from "@/lib/payments/payment.types";

type PaymentStatus =
  | "initiated"
  | "authorized"
  | "verifying"
  | "paid"
  | "failed"
  | "cancelled";

type GuardInput = {
  paymentIntentId: string;
  userId: string | null;
  systemMode?: boolean;
};

type PaymentIntentGuardRow = {
  buyer_id: string;
  status: PaymentStatus;
  total_amount: string;
  pi_payment_id: string | null;
  txid: string | null;
};

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

/* =========================================================
   MAIN GUARD (READ ONLY - SAFE)
========================================================= */

export async function guardPaymentForReconcile({
  paymentIntentId,
  userId,
  systemMode = false,
}: GuardInput): Promise<GuardPaymentResult> {
  if (!isUUID(paymentIntentId)) {
    return { ok: false, code: "PAYMENT_NOT_FOUND" };
  }

  const rs = await query<PaymentIntentGuardRow>(
    `
    SELECT
      buyer_id,
      status,
      total_amount,
      pi_payment_id,
      txid
    FROM payment_intents
    WHERE id = $1
    LIMIT 1
    `,
    [paymentIntentId]
  );

  if (!rs.rows.length) {
    return { ok: false, code: "PAYMENT_NOT_FOUND" };
  }

  const row = rs.rows[0];

  /* =========================================
     OWNER CHECK
  ========================================= */

  if (!systemMode) {
    if (!userId || !isUUID(userId) || row.buyer_id !== userId) {
      return { ok: false, code: "PAYMENT_FORBIDDEN" };
    }
  }

  /* =========================================
     BLOCK STATES
  ========================================= */

  if (row.status === "cancelled") {
    return { ok: false, code: "PAYMENT_CANCELLED" };
  }

  if (row.status === "failed") {
    return { ok: false, code: "PAYMENT_FAILED" };
  }

  if (row.status === "paid") {
    return { ok: false, code: "PAYMENT_ALREADY_PAID" };
  }

  return {
    ok: true,
    status: row.status,
    amount: Number(row.total_amount),
    piPaymentId: row.pi_payment_id,
    txid: row.txid,
  };
}

/* =========================================================
   SETTLEMENT LOCK (FIXED - NO STATUS WRITE HERE)
========================================================= */

export async function acquirePaymentSettlementLock(
  paymentIntentId: string
): Promise<PaymentLockResult> {
  if (!isUUID(paymentIntentId)) {
    return { ok: false, code: "LOCK_DENIED" };
  }

  /**
   * ❌ OLD: UPDATE status = 'verifying' (CAUSE LOCK CHAINS)
   *
   * ✅ NEW: only atomic lock attempt, no status mutation
   */

  const rs = await query<{ id: string }>(
    `
    UPDATE payment_intents
    SET updated_at = now()
    WHERE id = $1
      AND status IN ('authorized','verifying')
    RETURNING id
    `,
    [paymentIntentId]
  );

  if (!rs.rows.length) {
    return { ok: false, code: "LOCK_DENIED" };
  }

  return { ok: true };
}
