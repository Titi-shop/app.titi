/**
 * settlement.ledger.ts
 * Core escrow ledger system
 * - tạo escrow entry
 * - ghi seller credit
 * - ghi settlement events (audit trail)
 *
 * Mục tiêu:
 * - không bao giờ mất dấu tiền
 * - idempotent mọi thao tác
 * - trace được full lifecycle payment → payout
 */

import { randomUUID } from "crypto";

/* =========================
   TYPES
========================= */

export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REVERSED"
  | "SETTLED";

export type SettlementEventType =
  | "ESCROW_CREATED"
  | "PAYMENT_CONFIRMED"
  | "PI_VERIFIED"
  | "RPC_VERIFIED"
  | "ORDER_LINKED"
  | "ESCROW_RELEASED"
  | "SELLER_CREDITED"
  | "MANUAL_REVIEW_REQUIRED";

export type CreateEscrowInput = {
  paymentIntentId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  currency?: string;
};

/* =========================
   MOCK DB INTERFACE
   (replace with Prisma/SQL)
========================= */

const db = {
  escrow_entries: {
    create: async (data: any) => data,
    findUnique: async (_: any) => null,
    update: async (args: any) => args.data,
  },

  seller_credits: {
    create: async (data: any) => data,
  },

  settlement_events: {
    create: async (data: any) => data,
  },
};

/* =========================
   CORE LEDGER SERVICE
========================= */

export class SettlementLedger {
  /**
   * Create escrow entry when payment intent is created/confirmed
   */
  static async createEscrow(input: CreateEscrowInput) {
    const escrowId = randomUUID();

    const escrow = await db.escrow_entries.create({
      id: escrowId,
      paymentIntentId: input.paymentIntentId,
      orderId: input.orderId,
      buyerId: input.buyerId,
      sellerId: input.sellerId,
      amount: input.amount,
      currency: input.currency ?? "PI",
      status: "PENDING",
      createdAt: new Date(),
    });

    await this.logEvent({
      escrowId,
      type: "ESCROW_CREATED",
      metadata: input,
    });

    return escrow;
  }

  /**
   * Mark payment confirmed (after Pi / RPC verification)
   */
  static async markPaymentConfirmed(params: {
    escrowId: string;
    txid?: string;
    source: "PI" | "RPC";
  }) {
    await this.logEvent({
      escrowId: params.escrowId,
      type:
        params.source === "PI"
          ? "PI_VERIFIED"
          : "RPC_VERIFIED",
      metadata: {
        txid: params.txid,
      },
    });
  }

  /**
   * Link order after payment confirmed
   */
  static async linkOrder(params: {
    escrowId: string;
    orderId: string;
  }) {
    await this.logEvent({
      escrowId: params.escrowId,
      type: "ORDER_LINKED",
      metadata: params,
    });
  }

  /**
   * Release escrow → seller credit
   */
  static async releaseToSeller(params: {
    escrowId: string;
    sellerId: string;
    amount: number;
  }) {
    // 1. create seller credit
    await db.seller_credits.create({
      id: randomUUID(),
      sellerId: params.sellerId,
      escrowId: params.escrowId,
      amount: params.amount,
      status: "AVAILABLE",
      createdAt: new Date(),
    });

    // 2. log event
    await this.logEvent({
      escrowId: params.escrowId,
      type: "SELLER_CREDITED",
      metadata: params,
    });

    // 3. mark escrow released
    await db.escrow_entries.update({
      where: { id: params.escrowId },
      data: { status: "SETTLED" },
    });

    await this.logEvent({
      escrowId: params.escrowId,
      type: "ESCROW_RELEASED",
      metadata: params,
    });
  }

  /**
   * Flag for manual review
   */
  static async markManualReview(params: {
    escrowId: string;
    reason: string;
  }) {
    await this.logEvent({
      escrowId: params.escrowId,
      type: "MANUAL_REVIEW_REQUIRED",
      metadata: params,
    });

    await db.escrow_entries.update({
      where: { id: params.escrowId },
      data: { status: "FAILED" },
    });
  }

  /**
   * =========================
   * INTERNAL: EVENT LOGGER
   * =========================
   */
  private static async logEvent(params: {
    escrowId: string;
    type: SettlementEventType;
    metadata?: any;
  }) {
    return db.settlement_events.create({
      id: randomUUID(),
      escrowId: params.escrowId,
      type: params.type,
      metadata: params.metadata ?? {},
      createdAt: new Date(),
    });
  }
}
