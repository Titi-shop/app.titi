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

/* =========================================================
   LEDGER V2 CORE
========================================================= */

export class SettlementLedgerV2 {
  static async createEscrow(input: CreateEscrowInput) {
    const escrowId = randomUUID();

    await query(
      `
      insert into escrow_entries (
        id,
        payment_intent_id,
        order_id,
        buyer_id,
        seller_id,
        amount,
        status,
        txid,
        pi_payment_id
      )
      values ($1,$2,$3,$4,$5,$6,'PAID',$7,$8)
      on conflict (payment_intent_id)
      do nothing
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

    await this.event({
      escrowId,
      type: "ESCROW_CREATED",
      metadata: input,
    });

    return escrowId;
  }

  static async markPiVerified(escrowId: string) {
    await this.event({
      escrowId,
      type: "PI_VERIFIED",
    });
  }

  static async markRpcVerified(escrowId: string) {
    await this.event({
      escrowId,
      type: "RPC_VERIFIED",
    });
  }

  static async linkOrder(escrowId: string, orderId: string) {
    await this.event({
      escrowId,
      type: "ORDER_LINKED",
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
        status
      )
      values ($1,$2,$3,$4,'AVAILABLE')
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
      metadata: params,
    });
  }

  static async releaseEscrow(escrowId: string) {
    await query(
      `
      update escrow_entries
      set status = 'SETTLED', updated_at = now()
      where id = $1
      `,
      [escrowId]
    );

    await this.event({
      escrowId,
      type: "ESCROW_RELEASED",
    });
  }

  static async event(params: {
    escrowId: string;
    type: string;
    metadata?: any;
  }) {
    await query(
      `
      insert into settlement_events (
        id,
        escrow_id,
        event_type,
        metadata,
        created_at
      )
      values ($1,$2,$3,$4,now())
      `,
      [
        randomUUID(),
        params.escrowId,
        params.type,
        params.metadata ?? {},
      ]
    );
  }
}
