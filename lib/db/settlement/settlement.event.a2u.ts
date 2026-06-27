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

export enum WithdrawalSettlementEvents {
  WITHDRAW_APPROVED = "WITHDRAW_APPROVED",
  WITHDRAW_PROCESSING = "WITHDRAW_PROCESSING",
  JOURNAL_CREATED = "JOURNAL_CREATED",
  WITHDRAW_COMPLETED = "WITHDRAW_COMPLETED",
  BALANCE_RELEASED = "BALANCE_RELEASED",
  JOURNAL_REVERTED = "JOURNAL_REVERTED",
}
/* =====================================================
   LOG
===================================================== */

function log(
  step: string,
  data?: unknown
) {
  console.log(
    `[A2U_SETTLEMENT] ${step}`,
    data ?? ""
  );
}

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

  log(
    "START",
    {
      withdrawalId:
        params.withdrawalId,

      eventType:
        params.eventType,
    }
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

    log(
      "DUPLICATE_SKIP",
      {
        withdrawalId:
          params.withdrawalId,

        eventType:
          params.eventType,
      }
    );

    return;
  }

  log(
    "DONE",
    {
      withdrawalId:
        params.withdrawalId,

      eventType:
        params.eventType,
    }
  );
}
