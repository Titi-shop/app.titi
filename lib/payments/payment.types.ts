/* =========================================================
   PAYMENT TYPES MASTER CONTRACT
========================================================= */

/* =========================================================
   JSON SAFE TYPES
========================================================= */

export type JsonPrimitive =
  | string
  | number
  | boolean
  | null;

export type JsonValue =
  | JsonPrimitive
  | JsonObject
  | JsonValue[];

export type JsonObject = {
  [key: string]: JsonValue;
};

/* =========================================================
   PAYMENT FLOW SOURCE
========================================================= */

export type PaymentSettlementSource =
  | "client_submit"
  | "reconcile-api"
  | "pi_webhook"
  | "reconcile_job"
  | "manual_retry";

/* =========================================================
   ORCHESTRATOR INPUT
========================================================= */

export type RunPaymentSettlementInput = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
  source: PaymentSettlementSource;
  userId: string | null;
};

/* =========================================================
   ORCHESTRATOR RESULT
========================================================= */

export type PaymentSettlementResult = {
  ok: boolean;
  orderId: string | null;
  amount: number;
  piCompleted: boolean;
  rpcAudited: boolean;
  source: PaymentSettlementSource;
};

/* =========================================================
   PI VERIFY RESULT
========================================================= */

export type PiVerifyResult = {
  ok: boolean;
  verifiedAmount: number;
  receiverWallet: string;
  piPayload: JsonValue;
  reason: string | null;
};

/* =========================================================
   RPC VERIFY RESULT
========================================================= */

export type RpcAuditResult = {
  ok: boolean;
  audited: boolean;
  verified: boolean;

  amount: number | null;
  sender: string | null;
  receiver: string | null;

  ledger: number | null;
  confirmed: boolean;
  txStatus: string | null;
  chainReference: string | null;

  payload: JsonValue;
  reason: string | null;
  stage: string;
};

/* =========================================================
   PI COMPLETE RESULT
========================================================= */

export type PiCompleteResult = {
  ok: boolean;
  completed: boolean;
  reason: string | null;
};

/* =========================================================
   FINALIZE ORDER PARAMS
========================================================= */

export type FinalizePaidOrderParams = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;

  verifiedAmount: number;
  receiverWallet: string;

  piPayload: JsonValue;
  rpcPayload: RpcAuditResult;
};

/* =========================================================
   FINALIZE ORDER RESULT
========================================================= */

export type FinalizePaidOrderResult = {
  ok: boolean;
  already: boolean;
  orderId: string | null;
};

/* =========================================================
   PAYMENT JOB TYPES
========================================================= */

export type PaymentJobStatus =
  | "pending"
  | "processing"
  | "done"
  | "failed";

export type PaymentJobType = "reconcile";

export type EnqueueReconcileJobInput = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
  userId: string | null;
};

export type EnqueueReconcileJobResult = {
  id: string;
  status: PaymentJobStatus;
};

/* =========================================================
   PAYMENT GUARD RESULT
========================================================= */

export type GuardPaymentResult =
  | {
      ok: true;
      status: string;
      amount: number;
      piPaymentId: string | null;
      txid: string | null;
      orderId: string | null;
    }
  | {
      ok: false;
      code:
        | "PAYMENT_NOT_FOUND"
        | "PAYMENT_FORBIDDEN"
        | "PAYMENT_CANCELLED"
        | "PAYMENT_FAILED"
        | "PAYMENT_ALREADY_PAID";
      amount?: number;
      orderId?: string | null;
    };

/* =========================================================
   PAYMENT LOCK RESULT
========================================================= */

export type PaymentLockResult =
  | { ok: true }
  | { ok: false; code: "LOCK_DENIED" };

/* =========================================================
   WEBHOOK BODY
========================================================= */

export type PiWebhookPayload = {
  paymentId?: string;
  payment_id?: string;
  pi_payment_id?: string;
};

/* =========================================================
   ROUTE BODY
========================================================= */

export type SubmitPaymentBody = {
  payment_intent_id: string;
  pi_payment_id: string;
  txid: string;
};

export type ReconcilePaymentBody = {
  payment_intent_id: string;
  pi_payment_id: string;
  txid: string;
};

/* =========================================================
   AUDIT TYPES
========================================================= */

export type AuditSeverity =
  | "info"
  | "warn"
  | "error"
  | "critical";

export type AuditStage =
  | "INTENT"
  | "AUTHORIZE"
  | "SUBMIT"
  | "PI_VERIFY"
  | "RPC_VERIFY"
  | "PI_COMPLETE"
  | "FINALIZE"
  | "ESCROW"
  | "WEBHOOK"
  | "MANUAL";

/* =========================================================
   ESCROW TYPES
========================================================= */

export type EscrowStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REVERSED"
  | "SETTLED";

export type SettlementEventType =
  | "ESCROW_CREATED"
  | "PI_VERIFIED"
  | "RPC_VERIFIED"
  | "ORDER_LINKED"
  | "ESCROW_RELEASED"
  | "SELLER_CREDITED"
  | "MANUAL_REVIEW_REQUIRED";
