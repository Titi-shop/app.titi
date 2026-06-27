// =====================================================
// lib/db/settlement/settlement.event.a2u.ts
// =====================================================

import { randomUUID } from "crypto";

import { query } from "@/lib/db";

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

/* =====================================================
   CREATE WITHDRAW EVENT ONCE
===================================================== */

export async function createWithdrawalSettlementEventOnce(
  params: {
    withdrawalId: string;

    type: string;

    source: string;

    reason: string;

    metadata?: unknown;
  },

  client?: DbClient
): Promise<void> {

  const db =
    client ?? { query };

  console.log(
    "[A2U_SETTLEMENT][EVENT] START",
    {
      withdrawalId:
        params.withdrawalId,

      type:
        params.type,
    }
  );

  /* ===================================================
     BUILD EVENT HASH
  =================================================== */

  const payload = {
    withdrawalId:
      params.withdrawalId,

    type:
      params.type,

    source:
      params.source,

    reason:
      params.reason,

    metadata:
      params.metadata ?? {},
  };

  const eventHash =
    makeEventHash(payload);

  console.log(
    "[A2U_SETTLEMENT][EVENT] INSERT_START",
    {
      withdrawalId:
        params.withdrawalId,

      type:
        params.type,

      eventHash,
    }
  );

  /* ===================================================
     INSERT
  =================================================== */

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

        params.type,

        params.source,

        params.reason,

        JSON.stringify(
          params.metadata ?? {}
        ),

        eventHash,
      ]
    );

  if (
    (result.rowCount ?? 0) === 0
  ) {

    console.log(
      "[A2U_SETTLEMENT][EVENT] DUPLICATE_SKIP",
      {
        withdrawalId:
          params.withdrawalId,

        type:
          params.type,
      }
    );

    return;
  }

  console.log(
    "[A2U_SETTLEMENT][EVENT] DONE",
    {
      withdrawalId:
        params.withdrawalId,

      type:
        params.type,
    }
  );
}
