import { query } from "@/lib/db";
import { randomUUID } from "crypto";

/* =========================================================
   TYPES
========================================================= */

type CreateEscrowInput = {
  paymentIntentId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  txid: string;
  piPaymentId: string;
};

export class SettlementLedgerV2 {
  static async createEscrow(input: CreateEscrowInput): Promise<string> {
    const escrowId = randomUUID();

    const inserted = await query<{ id: string }>(
      `
      insert into escrow_entries (
        id,
        payment_intent_id,
        order_id,
        buyer_id,
        seller_id,
        amount,
        currency,
        status,
        release_status,
        txid,
        pi_payment_id,
        created_at,
        updated_at
      )
      values (
        $1,$2,$3,$4,$5,$6,
        'PI',
        'PAID',
        'HELD',
        $7,
        $8,
        now(),
        now()
      )
      on conflict (payment_intent_id)
      do update set updated_at = now()
      returning id
      `,
      [
        escrowId,
        input.paymentIntentId,
        input.orderId,
        input.buyerId,
        input.sellerId,
        input.amount,
        input.txid,
        input.piPaymentId,
      ]
    );

    const finalEscrowId = inserted.rows[0].id;

    await this.event({
      escrowId: finalEscrowId,
      type: "ESCROW_CREATED",
      source: "system",
      reason: "PAYMENT_CAPTURED",
      metadata: input,
    });

    return finalEscrowId;
  }

  static async markPiVerified(escrowId: string) {
    await this.event({
      escrowId,
      type: "PI_VERIFIED",
      source: "pi_api",
      reason: "PI_PAYMENT_VERIFIED",
    });
  }

  static async markRpcVerified(escrowId: string) {
    await this.event({
      escrowId,
      type: "RPC_VERIFIED",
      source: "rpc",
      reason: "CHAIN_TX_VERIFIED",
    });
  }

  static async linkOrder(escrowId: string, orderId: string) {
    await this.event({
      escrowId,
      type: "ORDER_LINKED",
      source: "order_engine",
      reason: "ORDER_CONNECTED",
      metadata: { orderId },
    });
  }

  static async creditSeller(params: {
    escrowId: string;
    sellerId: string;
    amount: number;
  }) {
    await query(
      `
      insert into seller_credits (
        id,
        seller_id,
        escrow_id,
        amount,
        currency,
        status,
        released,
        created_at
      )
      values ($1,$2,$3,$4,'PI','AVAILABLE',false,now())
      on conflict (escrow_id) do nothing
      `,
      [
        randomUUID(),
        params.sellerId,
        params.escrowId,
        params.amount,
      ]
    );

    await this.event({
      escrowId: params.escrowId,
      type: "SELLER_CREDITED",
      source: "ledger",
      reason: "SELLER_BALANCE_GRANTED",
      metadata: params,
    });
  }

  static async releaseEscrow(escrowId: string) {
    await query(
      `
      update escrow_entries
      set
        status = 'SETTLED',
        release_status = 'RELEASED',
        released_at = now(),
        updated_at = now()
      where id = $1
      `,
      [escrowId]
    );

    await this.event({
      escrowId,
      type: "ESCROW_RELEASED",
      source: "ledger",
      reason: "ESCROW_TO_SELLER",
    });
  }

  static async event(params: {
    escrowId: string;
    type: string;
    source: string;
    reason: string;
    metadata?: unknown;
  }) {
    await query(
      `
      insert into settlement_events (
        id,
        escrow_id,
        event_type,
        source,
        reason,
        metadata,
        created_at
      )
      values ($1,$2,$3,$4,$5,$6,now())
      `,
      [
        randomUUID(),
        params.escrowId,
        params.type,
        params.source,
        params.reason,
        params.metadata ?? {},
      ]
    );
  }
}
