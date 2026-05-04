/* =========================================================
   🔐 MONEY MODEL (NO FLOAT EVER)
========================================================= */

export type Currency = "PI";

export type Money = {
  amount: string; // decimal-safe: "12.00000000"
  currency: Currency;
};

export type MoneyInput = string | number | bigint;

/* =========================================================
   🔁 PAYMENT RUN SOURCE
========================================================= */

export type PaymentRunSource =
  | "CLIENT_SUBMIT"
  | "WEBHOOK"
  | "CRON_RETRY"
  | "MANUAL_ADMIN"
  | "RECONCILE_ENGINE";

/* =========================================================
   🧠 STRICT PAYMENT STATE MACHINE
   (NO INVALID JUMPS)
========================================================= */

export type PaymentIntentStatus =
  | "pending"
  | "created"
  | "wallet_opened"
  | "authorized"
  | "submitted"
  | "verifying"
  | "paid"
  | "failed"
  | "cancelled";

/**
 * HARD STATE TRANSITION RULES
 */
export type PaymentStateTransition =
  | { from: "pending"; to: "created" }
  | { from: "created"; to: "wallet_opened" }
  | { from: "wallet_opened"; to: "submitted" }
  | { from: "submitted"; to: "verifying" }
  | { from: "verifying"; to: "paid" }
  | { from: "verifying"; to: "failed" }
  | { from: "created"; to: "cancelled" }
  | { from: "submitted"; to: "cancelled" };

/* =========================================================
   🧾 SETTLEMENT STATE MACHINE (LEDGER LIFECYCLE)
========================================================= */

export type SettlementState =
  | "INIT"
  | "LOCKED"
  | "PI_VERIFIED"
  | "RPC_VERIFIED"
  | "ORDER_CREATED"
  | "ESCROW_CREATED"
  | "SELLER_CREDITED"
  | "RELEASED"
  | "SETTLED"
  | "REVERSED"
  | "MANUAL_REVIEW";

/* =========================================================
   ⚠️ RISK ENGINE
========================================================= */

export type PaymentRiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "BLOCKED";

/* =========================================================
   🧾 IDENTITY LAYER (TRACEABILITY)
========================================================= */

export type PaymentIdentity = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
  userId?: string | null;
};

/* =========================================================
   🔐 GUARD SYSTEM
========================================================= */

export type GuardPaymentFailCode =
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_FORBIDDEN"
  | "PAYMENT_CANCELLED"
  | "PAYMENT_FAILED"
  | "PAYMENT_ALREADY_PAID";

export type GuardPaymentResult =
  | {
      ok: true;
      status: PaymentIntentStatus;
      amount: number;
      piPaymentId: string | null;
      txid: string | null;
    }
  | {
      ok: false;
      code: GuardPaymentFailCode;
      orderId?: string | null;
      amount?: number;
    };

export type PaymentLockResult =
  | { ok: true; lockId?: string }
  | { ok: false; code: "LOCK_DENIED" };

/* =========================================================
   🧾 PI VERIFY (SOURCE OF TRUTH = PI CHAIN)
========================================================= */

export type PiVerifyErrorCode =
  | "PAYMENT_INTENT_NOT_FOUND"
  | "FORBIDDEN"
  | "PI_PAYMENT_ID_MISMATCH"
  | "INVALID_PAYMENT_STATE"
  | "PI_PAYMENT_CANCELLED"
  | "PI_NOT_APPROVED"
  | "PI_AMOUNT_MISMATCH"
  | "PI_RECEIVER_MISMATCH"
  | "PI_TXID_MISMATCH"
  | "PI_PAYMENT_FETCH_FAILED";

export type PiVerifyResult =
  | {
      ok: true;
      verifiedAmount: number;
      receiverWallet: string;
      piUid: string | null;
      piPayload: unknown;
    }
  | {
      ok: false;
      code: PiVerifyErrorCode;
    };

/* =========================================================
   🔗 RPC VERIFICATION (SECONDARY LEDGER SOURCE)
========================================================= */

export type RpcAuditStage =
  | "UNSET"
  | "FETCH_TX"
  | "VERIFY_LEDGER"
  | "VERIFY_AMOUNT"
  | "VERIFY_RECEIVER"
  | "FINALIZED";

export type RpcAuditReason =
  | "OK"
  | "NOT_EXECUTED"
  | "TX_NOT_FOUND"
  | "LEDGER_UNCONFIRMED"
  | "AMOUNT_MISMATCH"
  | "RECEIVER_MISMATCH"
  | "RPC_TIMEOUT"
  | "RPC_CRASH";

export type RpcAuditResult = {
  ok: boolean;
  audited: boolean;

  amount: number | null;
  sender: string | null;
  receiver: string | null;

  ledger: number | null;
  confirmed: boolean;

  chainReference: string | null;

  confirmations?: number;
  blockHeight?: number;

  stage: RpcAuditStage;
  reason: RpcAuditReason;

  payload: unknown;
};

/* =========================================================
   🧾 FINALIZATION RESULT
========================================================= */

export type FinalizeOrderResult =
  | {
      ok: true;
      already?: false;
      orderId: string;
      escrowId: string;
      buyerId: string;
      sellerId: string;
    }
  | {
      ok: true;
      already: true;
      orderId: string | null;
      escrowId?: string | null;
      buyerId: string;
      sellerId: string;
    };

/* =========================================================
   🧠 ORCHESTRATOR INPUT / OUTPUT
========================================================= */

export type RunPaymentSettlementInput = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
  userId?: string | null;
  source: PaymentRunSource;
};

export type PaymentSettlementResult = {
  ok: boolean;
  orderId: string | null;
  amount: number;
  piCompleted: boolean;
  rpcAudited: boolean;
  source: PaymentRunSource;
};

/* =========================================================
   🧾 LEDGER IDENTITY GRAPH
========================================================= */

export type LedgerIdentity = {
  escrowId: string;
  ledgerId?: string;
  chainTxid?: string;
};

/* =========================================================
   🧠 AUDIT CONTEXT
========================================================= */

export type AuditSeverity =
  | "info"
  | "warn"
  | "error"
  | "critical";

export type PaymentAuditContext = {
  source: PaymentRunSource;
  severity?: AuditSeverity;
  note?: string;
  traceId?: string;
};

/* =========================================================
   🔐 IDENTITY BINDING
========================================================= */

export type VerifiedMoneyContext = {
  verifiedAmount: number;
  receiverWallet: string;
  piUid: string | null;
};

/* =========================================================
   🧾 COMPLETE PAYMENT TRACE (FULL PIPELINE)
========================================================= */

export type PaymentTrace = {
  identity: PaymentIdentity;

  pi: {
    verified: boolean;
    payload?: unknown;
  };

  rpc: {
    verified: boolean;
    payload?: RpcAuditResult;
  };

  settlement: {
    state: SettlementState;
    escrowId?: string;
    orderId?: string;
  };
};
