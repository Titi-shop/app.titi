import { query } from "@/lib/db";
import { createHash, randomUUID } from "crypto";

/* =========================================================
   TYPES
========================================================= */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

/* =========================================================
   CONTEXT (🔥 CORE FIX V7)
========================================================= */

export type PaymentAuditContext = {
  requestId: string;

  paymentIntentId: string;

  orderId?: string | null;
  escrowId?: string | null;

  piPaymentId?: string | null;
  txid?: string | null;

  actorId?: string | null;
  source?: string | null;
};

/* =========================================================
   ENUMS
========================================================= */

export type AuditSeverity = "info" | "warn" | "error" | "critical";

export type AuditStage =
  | "INTENT"
  | "SUBMIT"
  | "PI_VERIFY"
  | "RPC_VERIFY"
  | "PI_COMPLETE"
  | "FINALIZE"
  | "LEDGER"
  | "MANUAL";

export type AuditActorType =
  | "system"
  | "api"
  | "pi_api"
  | "rpc"
  | "ledger";

/* =========================================================
   INPUT
========================================================= */

export type WriteAuditParams = {
  eventCode: string;
  stage: AuditStage;

  severity?: AuditSeverity;
  actorType?: AuditActorType;

  oldPaymentStatus?: string | null;
  newPaymentStatus?: string | null;

  oldSettlementState?: string | null;
  newSettlementState?: string | null;

  reconcileAttempt?: number;

  note?: string | null;
  payload?: JsonValue | null;
};

/* =========================================================
   NORMALIZE
========================================================= */

function normalize(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x.length ? x : null;
}

function makeHash(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

/* =========================================================
   PREVIOUS HASH
========================================================= */

async function getPreviousHash(paymentIntentId: string): Promise<string | null> {
  const rs = await query<{ event_hash: string }>(
    `
    SELECT event_hash
    FROM payment_audit_logs
    WHERE payment_intent_id = $1
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [paymentIntentId]
  );

  return rs.rows[0]?.event_hash ?? null;
}

/* =========================================================
   MAIN WRITER (V7 CORE)
========================================================= */

export async function writePaymentAudit(
  ctx: PaymentAuditContext,
  params: WriteAuditParams
): Promise<void> {
  const prevHash = await getPreviousHash(ctx.paymentIntentId);

  const payload = params.payload ?? {};

  const eventHash = makeHash({
    ctx,
    ...params,
    payload,
    prevHash,
    nonce: randomUUID(),
  });

  await query(
    `
    INSERT INTO payment_audit_logs (
      request_id,
      payment_intent_id,
      order_id,
      escrow_id,

      pi_payment_id,
      txid,

      event_code,
      stage,
      severity,

      actor_id,
      source,

      actor_type,

      old_payment_status,
      new_payment_status,

      old_settlement_state,
      new_settlement_state,

      reconcile_attempt,

      note,
      payload,

      prev_hash,
      event_hash,

      created_at
    )
    VALUES (
      $1,$2,$3,$4,
      $5,$6,
      $7,$8,$9,
      $10,$11,
      $12,
      $13,$14,
      $15,$16,
      $17,
      $18,$19,
      $20,$21,
      now()
    )
    `,
    [
      ctx.requestId,
      ctx.paymentIntentId,
      ctx.orderId ?? null,
      ctx.escrowId ?? null,

      normalize(ctx.piPaymentId),
      normalize(ctx.txid),

      params.eventCode,
      params.stage,
      params.severity ?? "info",

      ctx.actorId ?? null,
      normalize(ctx.source),

      params.actorType ?? "system",

      normalize(params.oldPaymentStatus),
      normalize(params.newPaymentStatus),

      normalize(params.oldSettlementState),
      normalize(params.newSettlementState),

      params.reconcileAttempt ?? 0,

      normalize(params.note),
      JSON.stringify(payload),

      prevHash,
      eventHash
    ]
  );
}

/* =========================================================
   PRESET HELPERS (V7)
========================================================= */

export const auditIntentCreated = (
  ctx: PaymentAuditContext,
  payload?: JsonValue
) =>
  writePaymentAudit(ctx, {
    eventCode: "INTENT_CREATED",
    stage: "INTENT",
    actorType: "api",
    newPaymentStatus: "created",
    newSettlementState: "UNSETTLED",
    payload,
  });

export const auditPiVerified = (
  ctx: PaymentAuditContext,
  payload?: JsonValue
) =>
  writePaymentAudit(ctx, {
    eventCode: "PI_VERIFIED",
    stage: "PI_VERIFY",
    actorType: "pi_api",
    newSettlementState: "PI_VERIFIED",
    payload,
  });

export const auditRpcVerified = (
  ctx: PaymentAuditContext,
  payload?: JsonValue
) =>
  writePaymentAudit(ctx, {
    eventCode: "RPC_VERIFIED",
    stage: "RPC_VERIFY",
    actorType: "rpc",
    newSettlementState: "RPC_AUDITED",
    payload,
  });

export const auditPiCompleted = (
  ctx: PaymentAuditContext,
  payload?: JsonValue
) =>
  writePaymentAudit(ctx, {
    eventCode: "PI_COMPLETED",
    stage: "PI_COMPLETE",
    actorType: "pi_api",
    newSettlementState: "PI_COMPLETED",
    payload,
  });

export const auditFinalizeDone = (
  ctx: PaymentAuditContext,
  payload?: JsonValue
) =>
  writePaymentAudit(ctx, {
    eventCode: "ORDER_FINALIZED",
    stage: "FINALIZE",
    actorType: "system",
    newPaymentStatus: "paid",
    newSettlementState: "ORDER_FINALIZED",
    payload,
  });

export const auditDuplicateSubmit = (
  ctx: PaymentAuditContext,
  payload?: JsonValue
) =>
  writePaymentAudit(ctx, {
    eventCode: "DUPLICATE_SUBMIT",
    stage: "SUBMIT",
    severity: "warn",
    actorType: "api",
    payload,
  });

export const auditManualReview = (
  ctx: PaymentAuditContext,
  reason: string,
  payload?: JsonValue
) =>
  writePaymentAudit(ctx, {
    eventCode: "MANUAL_REVIEW",
    stage: "MANUAL",
    severity: "critical",
    actorType: "system",
    note: reason,
    payload,
  });
