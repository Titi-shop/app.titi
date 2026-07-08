// =====================================================
// lib/db/settlement/settlement.event.ts
// =====================================================

import {
  query,
} from "@/lib/db";

import {
  randomUUID,
} from "crypto";

import {
  makeEventHash,
} from "./settlement.utils";
import {
  logger,
  maskId,
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

/* =====================================================
   CREATE EVENT ONCE
===================================================== */

export async function createSettlementEventOnce(
  params: {
    escrowId: string;
    type: string;
    source: string;
    reason: string;
    metadata?: unknown;
  },

  client?: DbClient
): Promise<void> {

  const db =
    client ?? { query };

  logger.info("SETTLEMENT.EVENT.START", {
  escrowId: maskId(params.escrowId),
  type: params.type,
});

  /* ===================================================
     BUILD HASH
  =================================================== */

  const payload = {
    escrowId:
      params.escrowId,

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

  logger.debug("SETTLEMENT.EVENT.INSERT_START", {
  escrowId: maskId(params.escrowId),
  type: params.type,
});

  /* ===================================================
     INSERT EVENT
  =================================================== */

  const result = await db.query(
  `
  INSERT INTO settlement_events (

      id,

      escrow_id,

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

      params.escrowId,

      params.type,

      params.source,

      params.reason,

      JSON.stringify(
        params.metadata ?? {}
      ),

      eventHash,
    ]
  );
if ((result.rowCount ?? 0) === 0) {
  logger.info("SETTLEMENT.EVENT.DUPLICATE_SKIP", {
  escrowId: maskId(params.escrowId),
  type: params.type,
});

  return;
}
  logger.info("SETTLEMENT.EVENT.DONE", {
  escrowId: maskId(params.escrowId),
  type: params.type,
});
}
