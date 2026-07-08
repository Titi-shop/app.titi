// =====================================================
// lib/db/settlement/settlement.event.a2u.ts
// =====================================================

import {
  randomUUID,
} from "crypto";

import {
  query,
} from "@/lib/db";

import {
  makeEventHash,
} from "./settlement.utils";
import {
  logger,
} from "@/lib/logger";
/* =====================================================
   TYPES
===================================================== */

type DbClient = {
  query: <T>(
    sql: string,
    params?: unknown[]
  ) => Promise<{
    rows: T[];
    rowCount?: number;
  }>;
};

export type WithdrawalSettlementEventInput =
  {
    withdrawalId: string;
    eventType: string;
    source: string;
    reason?: string;
    metadata?: unknown;
  };
/* =====================================================
   EVENTS
===================================================== */

export const WithdrawalSettlementEvents = {
  WITHDRAW_APPROVED: "WITHDRAW_APPROVED",
  WITHDRAW_PROCESSING: "WITHDRAW_PROCESSING",
  JOURNAL_CREATED: "JOURNAL_CREATED",
  WITHDRAW_COMPLETED: "WITHDRAW_COMPLETED",
  BALANCE_RELEASED: "BALANCE_RELEASED",
  JOURNAL_REVERTED: "JOURNAL_REVERTED",
  WITHDRAW_FAILED: "WITHDRAW_FAILED",
  WITHDRAW_RETRY: "WITHDRAW_RETRY",
} as const;


/* =====================================================
   CREATE EVENT
===================================================== */

export async function
createWithdrawalSettlementEventOnce(
  params:
    WithdrawalSettlementEventInput,

  client?: DbClient
): Promise<void> {

  const db =
    client ?? { query };

  logger.debug(
  "A2U_SETTLEMENT.START"
);

  /* ===============================================
     HASH
  =============================================== */

  const payload = {

    withdrawalId:
      params.withdrawalId,

    eventType:
      params.eventType,

    source:
      params.source,

    reason:
      params.reason ?? "",

    metadata:
      params.metadata ?? {},
  };

  const eventHash =
    makeEventHash(
      payload
    );

  /* ===============================================
     INSERT
  =============================================== */

  const result =
    await db.query(
      `
      INSERT INTO settlement_events (

        id,

        withdrawal_id,

        event_type,

        source,

        reason,

        metadata,

        event_hash,

        created_at

      )
      VALUES (

        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        NOW()

      )

      ON CONFLICT (event_hash)

      DO NOTHING
      `,
      [

        randomUUID(),

        params.withdrawalId,

        params.eventType,

        params.source,

        params.reason ?? null,

        JSON.stringify(
          params.metadata ?? {}
        ),

        eventHash,
      ]
    );

  if (
    (result.rowCount ?? 0)
    === 0
  ) {

    logger.debug(
  "A2U_SETTLEMENT.DUPLICATE_SKIP"
);

    return;
  }

  logger.debug(
  "A2U_SETTLEMENT.DONE"
);
}
