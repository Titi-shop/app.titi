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
  }
): Promise<void> {
  const existed =
    await query<{ id: string }>(
      `
      SELECT id
      FROM settlement_events
      WHERE escrow_id = $1
        AND event_type = $2
      LIMIT 1
      `,
      [
        params.escrowId,
        params.type,
      ]
    );
  if (existed.rows.length) {
    return;
  }
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
  await query(
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
      makeEventHash(payload),
    ]
  );
}
