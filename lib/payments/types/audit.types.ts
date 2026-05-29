import type {
  PaymentRunSource,
} from "./common.types";

/* =========================================================
   AUDIT
========================================================= */

export type AuditSeverity =
  | "info"
  | "warn"
  | "error"
  | "critical";

export type PaymentAuditContext =
  {
    source: PaymentRunSource;

    severity?: AuditSeverity;

    note?: string;

    traceId?: string;
  };
