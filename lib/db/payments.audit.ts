import { query } from "@/lib/db";

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
  | "FINALIZE"
  | "PI_COMPLETE"
  | "WEBHOOK"
  | "MANUAL";

type WriteAuditParams = {
  paymentIntentId: string;
  eventCode: string;
  stage: AuditStage;
  severity?: AuditSeverity;
  note?: string | null;
  payload?: JsonValue | null;
};

function normalizeText(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x.length ? x : null;
}

function normalizePayload(v: JsonValue | null | undefined): JsonValue | null {
  if (typeof v === "undefined") return null;
  return v;
}

/* =========================================================
   MAIN WRITE AUDIT
========================================================= */

export async function writePaymentAudit({
  paymentIntentId,
  eventCode,
  stage,
  severity = "info",
  note,
  payload,
}: WriteAuditParams): Promise<void> {
  await query(
    `
    INSERT INTO payment_audit_logs (
      payment_intent_id,
      event_code,
      stage,
      severity,
      note,
      payload
    )
    VALUES ($1,$2,$3,$4,$5,$6)
    `,
    [
      paymentIntentId,
      eventCode,
      stage,
      severity,
      normalizeText(note),
      JSON.stringify(normalizePayload(payload)),
    ]
  );
}

/* =========================================================
   PRESET HELPERS
========================================================= */

export async function auditIntentCreated(
  paymentIntentId: string,
  payload: JsonValue
): Promise<void> {
  await writePaymentAudit({
    paymentIntentId,
    eventCode: "INTENT_CREATED",
    stage: "INTENT",
    severity: "info",
    payload,
  });
}

export async function auditPiApproved(
  paymentIntentId: string,
  payload: JsonValue
): Promise<void> {
  await writePaymentAudit({
    paymentIntentId,
    eventCode: "PI_APPROVED",
    stage: "AUTHORIZE",
    severity: "info",
    payload,
  });
}

export async function auditSubmitLocked(
  paymentIntentId: string,
  payload: JsonValue
): Promise<void> {
  await writePaymentAudit({
    paymentIntentId,
    eventCode: "VERIFYING_LOCKED",
    stage: "SUBMIT",
    severity: "info",
    payload,
  });
}

export async function auditPiVerified(
  paymentIntentId: string,
  payload: JsonValue
): Promise<void> {
  await writePaymentAudit({
    paymentIntentId,
    eventCode: "PI_VERIFIED",
    stage: "PI_VERIFY",
    severity: "info",
    payload,
  });
}

export async function auditRpcVerified(
  paymentIntentId: string,
  payload: JsonValue
): Promise<void> {
  await writePaymentAudit({
    paymentIntentId,
    eventCode: "RPC_VERIFIED",
    stage: "RPC_VERIFY",
    severity: "info",
    payload,
  });
}

export async function auditRpcFailed(
  paymentIntentId: string,
  payload: JsonValue
): Promise<void> {
  await writePaymentAudit({
    paymentIntentId,
    eventCode: "RPC_FAILED",
    stage: "RPC_VERIFY",
    severity: "warn",
    payload,
  });
}

export async function auditFinalizeDone(
  paymentIntentId: string,
  payload: JsonValue
): Promise<void> {
  await writePaymentAudit({
    paymentIntentId,
    eventCode: "FINALIZED",
    stage: "FINALIZE",
    severity: "info",
    payload,
  });
}

export async function auditPiCompleted(
  paymentIntentId: string,
  payload: JsonValue
): Promise<void> {
  await writePaymentAudit({
    paymentIntentId,
    eventCode: "PI_COMPLETED",
    stage: "PI_COMPLETE",
    severity: "info",
    payload,
  });
}

export async function auditManualReview(
  paymentIntentId: string,
  reason: string,
  payload?: JsonValue
): Promise<void> {
  await writePaymentAudit({
    paymentIntentId,
    eventCode: "MANUAL_REVIEW",
    stage: "MANUAL",
    severity: "critical",
    note: reason,
    payload,
  });
}

export async function auditDuplicateSubmit(
  paymentIntentId: string,
  payload?: JsonValue
): Promise<void> {
  await writePaymentAudit({
    paymentIntentId,
    eventCode: "DUPLICATE_SUBMIT",
    stage: "SUBMIT",
    severity: "warn",
    payload,
  });
}
