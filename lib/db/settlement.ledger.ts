import { query } from "@/lib/db";
import { randomUUID, createHash } from "crypto";

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

type CreditSellerInput = {
  escrowId: string;
  sellerId: string;
  amount: number;
  piPaymentId?: string;
};

type RefundBuyerInput = {
  escrowId: string;
  buyerId: string;
  amount: number;
  reason?: string;
  refundTxid?: string;
  piPaymentId?: string;
  approvedBy?: string | null;
};

type WithdrawSellerInput = {
  sellerCreditId: string;
  sellerId: string;
  amount: number;
  withdrawWallet: string;
  txid?: string;
};

/* =========================================================
   HASH EVENT (ANTI TAMPER LIGHT)
========================================================= */

function makeEventHash(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

/* =========================================================
   MAIN CLASS
========================================================= */

export class SettlementLedgerV3 {
  /* =====================================================
     1. CREATE ESCROW ROOT
  ===================================================== */

  static async createEscrow(input: CreateEscrowInput): Promise<string> {
    const escrowId = randomUUID();

    const rs = await query<{ id: string }>(
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
        now(),
        now(),
        now()
      )
      ON CONFLICT (payment_intent_id)
      DO UPDATE SET updated_at = now()
      RETURNING id
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

    const finalEscrowId = rs.rows[0].id;

    await this.event({
      escrowId: finalEscrowId,
      type: "ESCROW_CREATED",
      source: "system",
      reason: "PAYMENT_CAPTURED",
      metadata: input,
    });

    await this.journal({
      ownerId: input.buyerId,
      ownerType: "BUYER",
      refId: finalEscrowId,
      refTable: "escrow_entries",
      entryType: "ESCROW_HOLD",
      direction: "DEBIT",
      amount: input.amount,
      note: "Buyer funds moved into escrow",
    });

    return finalEscrowId;
  }

  /* =====================================================
     2. PI VERIFIED EVENT
  ===================================================== */

  static async markPiVerified(escrowId: string) {
    await this.event({
      escrowId,
      type: "PI_VERIFIED",
      source: "pi_api",
      reason: "PI_PAYMENT_VERIFIED",
    });
  }

  /* =====================================================
     3. RPC VERIFIED EVENT
  ===================================================== */

  static async markRpcVerified(escrowId: string) {
    await this.event({
      escrowId,
      type: "RPC_VERIFIED",
      source: "rpc",
      reason: "CHAIN_TX_VERIFIED",
    });
  }

  /* =====================================================
     4. LINK ORDER
  ===================================================== */

  static async linkOrder(escrowId: string, orderId: string) {
    await this.event({
      escrowId,
      type: "ORDER_LINKED",
      source: "order_engine",
      reason: "ORDER_CONNECTED",
      metadata: { orderId },
    });
  }

  /* =====================================================
     5. CREDIT SELLER INTERNAL WALLET
  ===================================================== */

  static async creditSeller(input: CreditSellerInput): Promise<string> {
    const creditId = randomUUID();

    const escrowRes = await query<{ amount: string }>(
      `SELECT amount FROM escrow_entries WHERE id = $1 LIMIT 1`,
      [input.escrowId]
    );

    const escrowAmount = Number(escrowRes.rows[0]?.amount ?? 0);

    const availableAmount = escrowAmount;

    await query(
      `
      INSERT INTO seller_credits (
        id,
        seller_id,
        escrow_id,
        amount,
        withdrawn_amount,
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
        $1,$2,$3,$4,
        0,$5,
        'PI',
        'AVAILABLE',
        $6,
        'ORDER_PAYMENT',
        now(),
        now(),
        now()
      )
      ON CONFLICT (escrow_id) DO NOTHING
      `,
      [
        creditId,
        input.sellerId,
        input.escrowId,
        input.amount,
        availableAmount,
        input.piPaymentId ?? null,
      ]
    );

    await this.event({
      escrowId: input.escrowId,
      type: "SELLER_CREDITED",
      source: "ledger",
      reason: "SELLER_BALANCE_GRANTED",
      metadata: input,
    });

    await this.journal({
      ownerId: input.sellerId,
      ownerType: "SELLER",
      refId: input.escrowId,
      refTable: "seller_credits",
      entryType: "SELLER_CREDIT",
      direction: "CREDIT",
      amount: input.amount,
      note: "Seller internal wallet credited",
    });

    return creditId;
  }

  /* =====================================================
     6. RELEASE ESCROW
  ===================================================== */

  static async releaseEscrow(escrowId: string) {
    const escrowRes = await query<{ amount: string; released_amount: string }>(
      `
      SELECT amount, released_amount
      FROM escrow_entries
      WHERE id = $1
      LIMIT 1
      `,
      [escrowId]
    );

    const total = Number(escrowRes.rows[0]?.amount ?? 0);

    await query(
      `
      UPDATE escrow_entries
      SET
        status = 'SETTLED',
        release_status = 'RELEASED',
        released_amount = $2,
        released_at = now(),
        escrow_version = escrow_version + 1,
        updated_at = now()
      WHERE id = $1
      `,
      [escrowId, total]
    );

    await this.event({
      escrowId,
      type: "ESCROW_RELEASED",
      source: "ledger",
      reason: "ESCROW_TO_SELLER",
    });
  }

  /* =====================================================
     7. REFUND BUYER
  ===================================================== */

  static async refundBuyer(input: RefundBuyerInput) {
    await query(
      `
      INSERT INTO buyer_refund_ledger (
        id,
        escrow_id,
        buyer_id,
        amount,
        reason,
        status,
        refund_txid,
        pi_payment_id,
        refund_source,
        approved_by,
        processed_at,
        created_at
      )
      VALUES (
        $1,$2,$3,$4,$5,
        'REFUNDED',
        $6,$7,
        'SYSTEM',
        $8,
        now(),
        now()
      )
      `,
      [
        randomUUID(),
        input.escrowId,
        input.buyerId,
        input.amount,
        input.reason ?? null,
        input.refundTxid ?? null,
        input.piPaymentId ?? null,
        input.approvedBy ?? null,
      ]
    );

    await query(
      `
      UPDATE escrow_entries
      SET
        status = 'REFUNDED',
        refunded_amount = refunded_amount + $2,
        escrow_version = escrow_version + 1,
        updated_at = now()
      WHERE id = $1
      `,
      [input.escrowId, input.amount]
    );

    await this.event({
      escrowId: input.escrowId,
      type: "BUYER_REFUNDED",
      source: "refund_engine",
      reason: input.reason ?? "BUYER_REFUND",
      metadata: input,
    });

    await this.journal({
      ownerId: input.buyerId,
      ownerType: "BUYER",
      refId: input.escrowId,
      refTable: "buyer_refund_ledger",
      entryType: "BUYER_REFUND",
      direction: "CREDIT",
      amount: input.amount,
      note: "Buyer refunded from escrow",
    });
  }

  /* =====================================================
     8. SELLER WITHDRAW
  ===================================================== */

  static async withdrawSeller(input: WithdrawSellerInput) {
    const creditRes = await query<{
      available_amount: string;
    }>(
      `
      SELECT available_amount
      FROM seller_credits
      WHERE id = $1
      LIMIT 1
      `,
      [input.sellerCreditId]
    );

    const available = Number(creditRes.rows[0]?.available_amount ?? 0);

    if (available < input.amount) {
      throw new Error("INSUFFICIENT_SELLER_BALANCE");
    }

    await query(
      `
      INSERT INTO seller_withdrawals (
        id,
        seller_id,
        seller_credit_id,
        amount,
        currency,
        withdraw_wallet,
        txid,
        status,
        requested_at,
        completed_at
      )
      VALUES (
        $1,$2,$3,$4,'PI',$5,$6,'SENT',now(),now()
      )
      `,
      [
        randomUUID(),
        input.sellerId,
        input.sellerCreditId,
        input.amount,
        input.withdrawWallet,
        input.txid ?? null,
      ]
    );

    await query(
      `
      UPDATE seller_credits
      SET
        withdrawn_amount = withdrawn_amount + $2,
        available_amount = available_amount - $2,
        status = CASE
          WHEN available_amount - $2 <= 0 THEN 'WITHDRAWN'
          ELSE 'PARTIAL_WITHDRAWN'
        END,
        chain_txid = COALESCE($3, chain_txid),
        updated_at = now()
      WHERE id = $1
      `,
      [input.sellerCreditId, input.amount, input.txid ?? null]
    );

    await this.journal({
      ownerId: input.sellerId,
      ownerType: "SELLER",
      refId: input.sellerCreditId,
      refTable: "seller_withdrawals",
      entryType: "SELLER_WITHDRAW",
      direction: "DEBIT",
      amount: input.amount,
      note: "Seller withdrawal processed",
    });
  }

  /* =====================================================
     9. EVENT LOGGER
  ===================================================== */

  static async event(params: {
    escrowId: string;
    type: string;
    source: string;
    reason: string;
    metadata?: unknown;
  }) {
    const hash = makeEventHash(params);

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
      VALUES ($1,$2,$3,$4,$5,$6,$7,now())
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

  /* =====================================================
     10. WALLET JOURNAL LOGGER
  ===================================================== */

  static async journal(params: {
    ownerId: string;
    ownerType: string;
    refId: string;
    refTable: string;
    entryType: string;
    direction: string;
    amount: number;
    note?: string;
  }) {
    await query(
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
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,'PI',$9,now()
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
