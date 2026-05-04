import { query } from "@/lib/db";
import { createHash, randomUUID } from "crypto";

/* =========================================================
   TYPES
========================================================= */

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

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
  | "LEDGER"
  | "WEBHOOK"
  | "MANUAL";

export type AuditActorType =
  | "system"
  | "api"
  | "cron"
  | "admin"
  | "pi_api"
  | "rpc"
  | "ledger";

type WriteAuditParams = {
  paymentIntentId: string;

  eventCode: string;
  stage: AuditStage;

  severity?: AuditSeverity;

  actorType?: AuditActorType;
  actorId?: string | null;

  source?: string | null;
  requestId?: string | null;

  orderId?: string | null;
  escrowId?: string | null;

  piPaymentId?: string | null;
  txid?: string | null;

  oldPaymentStatus?: string | null;
  newPaymentStatus?: string | null;

  oldSettlementState?: string | null;
  newSettlementState?: string | null;

  reconcileAttempt?: number;

  note?: string | null;
  payload?: JsonValue | null;
};

/* =========================================================
   NORMALIZERS
========================================================= */

function normalizeText(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x.length ? x : null;
}

function normalizePayload(v: JsonValue | null | undefined): JsonValue {
  if (typeof v === "undefined" || v === null) return {};
  return v;
}

function makeHash(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

/* =========================================================
   GET PREVIOUS HASH
========================================================= */

async function getPreviousHash(paymentIntentId: string): Promise<string | null> {
  const rs = await query<{ event_hash: string }>(
    `
    SELECT event_hash
    FROM payment_audit_logs
    WHERE payment_intent_id = $1
    ORDER BY event_index DESC
    LIMIT 1
    `,
    [paymentIntentId]
  );

  return rs.rows[0]?.event_hash ?? null;
}

/* =========================================================
   MAIN IMMUTABLE AUDIT WRITER
========================================================= */

export async function writePaymentAudit({
  paymentIntentId,

  eventCode,
  stage,
  severity = "info",

  actorType = "system",
  actorId,

  source,
  requestId,

  orderId,
  escrowId,

  piPaymentId,
  txid,

  oldPaymentStatus,
  newPaymentStatus,

  oldSettlementState,
  newSettlementState,

  reconcileAttempt = 0,

  note,
  payload,
}: WriteAuditParams): Promise<void> {
  const prevHash = await getPreviousHash(paymentIntentId);

  const normalizedPayload = normalizePayload(payload);

  const eventHash = makeHash({
    paymentIntentId,
    eventCode,
    stage,
    severity,
    actorType,
    actorId,
    source,
    requestId,
    orderId,
    escrowId,
    piPaymentId,
    txid,
    oldPaymentStatus,
    newPaymentStatus,
    oldSettlementState,
    newSettlementState,
    reconcileAttempt,
    note,
    payload: normalizedPayload,
    prevHash,
    nonce: randomUUID(),
  });

  await query(
    `
    INSERT INTO payment_audit_logs (
      payment_intent_id,
      order_id,
      escrow_id,
      pi_payment_id,
      txid,

      event_code,
      stage,
      severity,

      actor_type,
      actor_id,
      source,
      request_id,

      old_payment_status,
      new_payment_status,

      old_settlement_state,
      new_settlement_state,

      reconcile_attempt,

      note,
      payload,

      prev_hash,
      event_hash
    )
    VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,
      $9,$10,$11,$12,
      $13,$14,
      $15,$16,
      $17,
      $18,$19,
      $20,$21
    )
    `,
    [
      paymentIntentId,
      orderId ?? null,
      escrowId ?? null,
      normalizeText(piPaymentId),
      normalizeText(txid),

      eventCode,
      stage,
      severity,

      actorType,
      actorId ?? null,
      normalizeText(source),
      normalizeText(requestId),

      normalizeText(oldPaymentStatus),
      normalizeText(newPaymentStatus),

      normalizeText(oldSettlementState),
      normalizeText(newSettlementState),

      reconcileAttempt,

      normalizeText(note),
      JSON.stringify(normalizedPayload),

      prevHash,
      eventHash,
    ]
  );
}

/* =========================================================
   PRESET HELPERS
========================================================= */

export const auditIntentCreated = (
  paymentIntentId: string,
  payload?: JsonValue
) =>
  writePaymentAudit({
    paymentIntentId,
    eventCode: "INTENT_CREATED",
    stage: "INTENT",
    actorType: "api",
    newPaymentStatus: "created",
    newSettlementState: "UNSETTLED",
    payload,
  });

export const auditPiVerified = (
  paymentIntentId: string,
  payload?: JsonValue
) =>
  writePaymentAudit({
    paymentIntentId,
    eventCode: "PI_VERIFIED",
    stage: "PI_VERIFY",
    actorType: "pi_api",
    oldSettlementState: "UNSETTLED",
    newSettlementState: "PI_VERIFIED",
    payload,
  });

export const auditRpcVerified = (
  paymentIntentId: string,
  payload?: JsonValue
) =>
  writePaymentAudit({
    paymentIntentId,
    eventCode: "RPC_VERIFIED",
    stage: "RPC_VERIFY",
    actorType: "rpc",
    oldSettlementState: "PI_VERIFIED",
    newSettlementState: "RPC_AUDITED",
    payload,
  });

export const auditRpcFailed = (
  paymentIntentId: string,
  payload?: JsonValue
) =>
  writePaymentAudit({
    paymentIntentId,
    eventCode: "RPC_FAILED",
    stage: "RPC_VERIFY",
    severity: "warn",
    actorType: "rpc",
    payload,
  });

export const auditPiCompleted = (
  paymentIntentId: string,
  payload?: JsonValue
) =>
  writePaymentAudit({
    paymentIntentId,
    eventCode: "PI_COMPLETED",
    stage: "PI_COMPLETE",
    actorType: "pi_api",
    oldSettlementState: "RPC_AUDITED",
    newSettlementState: "PI_COMPLETED",
    payload,
  });

export const auditFinalizeDone = (
  paymentIntentId: string,
  payload?: JsonValue
) =>
  writePaymentAudit({
    paymentIntentId,
    eventCode: "ORDER_FINALIZED",
    stage: "FINALIZE",
    actorType: "system",
    oldPaymentStatus: "verifying",
    newPaymentStatus: "paid",
    oldSettlementState: "PI_COMPLETED",
    newSettlementState: "ORDER_FINALIZED",
    payload,
  });

export const auditDuplicateSubmit = (
  paymentIntentId: string,
  payload?: JsonValue
) =>
  writePaymentAudit({
    paymentIntentId,
    eventCode: "DUPLICATE_SUBMIT",
    stage: "SUBMIT",
    severity: "warn",
    actorType: "api",
    payload,
  });

export const auditManualReview = (
  paymentIntentId: string,
  reason: string,
  payload?: JsonValue
) =>
  writePaymentAudit({
    paymentIntentId,
    eventCode: "MANUAL_REVIEW",
    stage: "MANUAL",
    severity: "critical",
    actorType: "system",
    note: reason,
    payload,
  });
