import { randomUUID, createHash } from "crypto";
import type { PoolClient } from "pg";

/* =========================================================
   TYPES
========================================================= */

export type SettlementClient = PoolClient;

type CreateEscrowInput = {
  paymentIntentId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  txid: string;
  piPaymentId: string;
};

type CreditSellerInput = {
  escrowId: string;
  sellerId: string;
  paymentIntentId: string;
  orderId: string;
  amount: number;
  piPaymentId: string;
};

type EventInput = {
  escrowId: string;
  type: string;
  source: string;
  reason: string;
  metadata?: unknown;
};

type JournalInput = {
  ownerId: string;
  ownerType: "BUYER" | "SELLER" | "SYSTEM";
  refId: string;
  refTable: string;
  entryType:
    | "ESCROW_HOLD"
    | "SELLER_CREDIT"
    | "SELLER_WITHDRAW"
    | "BUYER_REFUND"
    | "ADMIN_REVERSE";
  direction: "CREDIT" | "DEBIT";
  amount: number;
  note?: string;
};

/* =========================================================
   HELPERS
========================================================= */

function makeEventHash(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

/* =========================================================
   FINAL LEDGER CLASS
========================================================= */

export class SettlementLedgerV4 {
  static async createEscrow(
    client: SettlementClient,
    input: CreateEscrowInput
  ): Promise<string> {
    console.log("[LEDGER] CREATE_ESCROW_START", {
      paymentIntentId: input.paymentIntentId,
      piPaymentId: input.piPaymentId,
    });

    const rs = await client.query<{ id: string }>(
      `
      INSERT INTO escrow_entries (
        id,
        payment_intent_id,
        order_id,
        buyer_id,
        seller_id,
        amount,
        released_amount,
        refunded_amount,
        currency,
        status,
        release_status,
        txid,
        pi_payment_id,
        held_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        0,0,
        'PI',
        'PAID',
        'HOLD',
        $7,$8,
        now(),now(),now()
      )
      ON CONFLICT (payment_intent_id)
      DO UPDATE SET
        order_id = EXCLUDED.order_id,
        txid = EXCLUDED.txid,
        pi_payment_id = EXCLUDED.pi_payment_id,
        updated_at = now()
      RETURNING id
      `,
      [
        randomUUID(),
        input.paymentIntentId,
        input.orderId,
        input.buyerId,
        input.sellerId,
        input.amount,
        input.txid,
        input.piPaymentId,
      ]
    );

    const escrowId = rs.rows[0].id;

    await this.event(client, {
      escrowId,
      type: "ESCROW_CREATED",
      source: "system",
      reason: "PAYMENT_CAPTURED",
      metadata: input,
    });

    await this.journal(client, {
      ownerId: input.buyerId,
      ownerType: "BUYER",
      refId: escrowId,
      refTable: "escrow_entries",
      entryType: "ESCROW_HOLD",
      direction: "DEBIT",
      amount: input.amount,
      note: "Buyer funds moved into escrow",
    });

    console.log("[LEDGER] CREATE_ESCROW_DONE", { escrowId });

    return escrowId;
  }

  static async markPiVerified(
    client: SettlementClient,
    escrowId: string
  ): Promise<void> {
    await this.event(client, {
      escrowId,
      type: "PI_VERIFIED",
      source: "pi_api",
      reason: "PI_PAYMENT_VERIFIED",
    });
  }

  static async markRpcVerified(
    client: SettlementClient,
    escrowId: string
  ): Promise<void> {
    await this.event(client, {
      escrowId,
      type: "RPC_VERIFIED",
      source: "rpc",
      reason: "CHAIN_TX_VERIFIED",
    });
  }

  static async linkOrder(
    client: SettlementClient,
    escrowId: string,
    orderId: string
  ): Promise<void> {
    await this.event(client, {
      escrowId,
      type: "ORDER_LINKED",
      source: "order_engine",
      reason: "ORDER_CONNECTED",
      metadata: { orderId },
    });
  }

  static async creditSeller(
    client: SettlementClient,
    input: CreditSellerInput
  ): Promise<void> {
    console.log("[LEDGER] CREDIT_SELLER_START", {
      escrowId: input.escrowId,
      sellerId: input.sellerId,
    });

    await client.query(
      `
      INSERT INTO seller_credits (
        id,
        seller_id,
        escrow_id,
        payment_intent_id,
        order_id,
        amount,
        withdrawn_amount,
        reversed_amount,
        frozen_amount,
        available_amount,
        currency,
        status,
        pi_payment_id,
        credit_source,
        released_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,
        0,0,0,
        $7,
        'PI',
        'AVAILABLE',
        $8,
        'ORDER_PAYMENT',
        now(),now(),now()
      )
      ON CONFLICT (escrow_id)
      DO UPDATE SET
        order_id = EXCLUDED.order_id,
        pi_payment_id = EXCLUDED.pi_payment_id,
        updated_at = now()
      `,
      [
        randomUUID(),
        input.sellerId,
        input.escrowId,
        input.paymentIntentId,
        input.orderId,
        input.amount,
        input.amount,
        input.piPaymentId,
      ]
    );

    await this.event(client, {
      escrowId: input.escrowId,
      type: "SELLER_CREDITED",
      source: "ledger",
      reason: "SELLER_BALANCE_GRANTED",
      metadata: input,
    });

    await this.journal(client, {
      ownerId: input.sellerId,
      ownerType: "SELLER",
      refId: input.escrowId,
      refTable: "seller_credits",
      entryType: "SELLER_CREDIT",
      direction: "CREDIT",
      amount: input.amount,
      note: "Seller internal wallet credited",
    });

    console.log("[LEDGER] CREDIT_SELLER_DONE");
  }

  static async releaseEscrow(
    client: SettlementClient,
    escrowId: string
  ): Promise<void> {
    await client.query(
      `
      UPDATE escrow_entries
      SET
        status = 'SETTLED',
        release_status = 'RELEASED',
        released_amount = amount,
        released_at = now(),
        escrow_version = escrow_version + 1,
        updated_at = now()
      WHERE id = $1
      `,
      [escrowId]
    );

    await this.event(client, {
      escrowId,
      type: "ESCROW_RELEASED",
      source: "ledger",
      reason: "ESCROW_TO_SELLER",
    });
  }

  static async event(
    client: SettlementClient,
    params: EventInput
  ): Promise<void> {
    const hash = makeEventHash({
      escrowId: params.escrowId,
      type: params.type,
      reason: params.reason,
    });

    await client.query(
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
      SELECT $1,$2,$3,$4,$5,$6,$7,now()
      WHERE NOT EXISTS (
        SELECT 1 FROM settlement_events
        WHERE escrow_id = $2
          AND event_hash = $7
      )
      `,
      [
        randomUUID(),
        params.escrowId,
        params.type,
        params.source,
        params.reason,
        JSON.stringify(params.metadata ?? {}),
        hash,
      ]
    );
  }

  static async journal(
    client: SettlementClient,
    params: JournalInput
  ): Promise<void> {
    await client.query(
      `
      INSERT INTO wallet_journal (
        id,
        owner_id,
        owner_type,
        ref_id,
        ref_table,
        entry_type,
        direction,
        amount,
        currency,
        note,
        created_at
      )
      SELECT
        $1,$2,$3,$4,$5,$6,$7,$8,'PI',$9,now()
      WHERE NOT EXISTS (
        SELECT 1 FROM wallet_journal
        WHERE owner_id = $2
          AND ref_id = $4
          AND entry_type = $6
          AND direction = $7
      )
      `,
      [
        randomUUID(),
        params.ownerId,
        params.ownerType,
        params.refId,
        params.refTable,
        params.entryType,
        params.direction,
        params.amount,
        params.note ?? null,
      ]
    );
  }
}
