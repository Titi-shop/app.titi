import { withTransaction } from "@/lib/db";
import type { PoolClient } from "pg";
import { getRpcVerificationLog } from "@/lib/db/payments.rpc";
import type {
  UpsertPaymentReceiptInput,
} from "./orders.payment.types";
import {
  logger,
  maskId,
  maskWallet,
} from "@/lib/logger";

export async function upsertPaymentReceipt(
  client: PoolClient,
  input: UpsertPaymentReceiptInput
): Promise<void> {
  const {
    paymentIntentId,
    buyerId,
    orderId,
    expectedAmount,
    verifiedAmount,

    piPaymentId,
    txid,

    receiverWallet,
    escrowId,
    sellerCreditId,
    piPayload,
  } = input;

  const rpcPayload =
    await getRpcVerificationLog(paymentIntentId);

  if (!rpcPayload) {
    throw new Error("RPC_LOG_NOT_FOUND");
  }

  try {
  await client.query(
    `
    INSERT INTO payment_receipts(
      payment_intent_id,
      user_id,
      order_id,
      escrow_id,
      seller_credit_id,
      pi_payment_id,
      pi_uid,
      txid,

      expected_amount,
      verified_amount,
      currency,

      sender_wallet,
      receiver_wallet,

      verification_status,
      verify_source,
      settlement_state,

      rpc_confirmed,
      rpc_ledger,
      chain_reference,

      tx_status,
      developer_completed,
      rpc_reason,

      pi_payload,
      merged_payload,

      developer_completed_at,

      pi_created_at,
      pi_memo,

      rpc_tx_status,
      rpc_stage,

      idempotency_key,

      verified_at,
      completed_at,
      created_at,
      updated_at
    )
    VALUES (
      $1,$2,$3,$4,
      $5,$6,$7,
      $8,$9,$10,
      $11,$12,
      $13,$14,$15,
      $16,$17,$18,
      $19,$20,$21,
      $22,$23,$24,
      $25,
      $26,$27,
      $28,$29,
      $30,
      now(),now(),now(),now()
    )
    ON CONFLICT (pi_payment_id)
    DO UPDATE SET

      order_id = EXCLUDED.order_id,
      escrow_id = EXCLUDED.escrow_id,

      pi_uid = EXCLUDED.pi_uid,

      sender_wallet = EXCLUDED.sender_wallet,
      receiver_wallet = EXCLUDED.receiver_wallet,

      rpc_confirmed = EXCLUDED.rpc_confirmed,
      rpc_ledger = EXCLUDED.rpc_ledger,
      chain_reference = EXCLUDED.chain_reference,

      tx_status = EXCLUDED.tx_status,
      developer_completed = EXCLUDED.developer_completed,
      rpc_reason = EXCLUDED.rpc_reason,

      pi_payload = EXCLUDED.pi_payload,
      merged_payload = EXCLUDED.merged_payload,

      pi_created_at = EXCLUDED.pi_created_at,
      pi_memo = EXCLUDED.pi_memo,

      rpc_tx_status = EXCLUDED.rpc_tx_status,
      rpc_stage = EXCLUDED.rpc_stage,

      verification_status = EXCLUDED.verification_status,
      verify_source = EXCLUDED.verify_source,
      settlement_state = EXCLUDED.settlement_state,

      developer_completed_at =
        EXCLUDED.developer_completed_at,

      verified_at = now(),
      completed_at = now(),
      updated_at = now()
    `,
    [
  paymentIntentId,
  buyerId,
  orderId,
  escrowId ?? null,
  sellerCreditId ?? null,

  piPaymentId,
  piPayload.user_uid ?? null,
  txid,

  expectedAmount,
  verifiedAmount,
  "PI",

      piPayload.from_address ?? null,
      piPayload.to_address ?? receiverWallet,

      "completed",
      "DUAL_AUDIT",
      "ORDER_FINALIZED",

      rpcPayload.confirmed ??
        rpcPayload.ok ??
        false,

      rpcPayload.ledger ?? null,

      rpcPayload.chainReference ??
        txid,

      rpcPayload.txStatus ??
        (
          rpcPayload.confirmed
            ? "CONFIRMED"
            : "UNCONFIRMED"
        ),

      piPayload.status
        ?.developer_completed ??
        false,

      rpcPayload.reason ??
        "NONE",

      JSON.stringify({
        memo:
          piPayload.memo ??
          null,

        amount:
          piPayload.amount ??
          verifiedAmount,

        network:
          piPayload.network ??
          null,

        identifier:
          piPayload.identifier ??
          null,

        txid:
          piPayload.transaction
            ?.txid ??
          txid,

        verified:
          piPayload.transaction
            ?.verified ??
          true,

        created_at:
          piPayload.created_at ??
          null,
      }),

      JSON.stringify({
  pi_summary: {
    amount: piPayload.amount ?? verifiedAmount,
    memo: piPayload.memo ?? null,
    developer_completed:
      piPayload.status?.developer_completed ?? false,
  },

  verification: {
    verified: rpcPayload.ok,
    confirmed: rpcPayload.confirmed,
    ledger: rpcPayload.ledger,
    txStatus: rpcPayload.txStatus,
    chainReference: rpcPayload.chainReference,
  },
}),

      piPayload.status
        ?.developer_completed
        ? new Date()
        : null,

      piPayload.created_at
        ? new Date(
            piPayload.created_at
          )
        : null,

      piPayload.memo ??
        null,

      rpcPayload.txStatus ??
        "CONFIRMED",

      rpcPayload.stage ??
        null,

      paymentIntentId,
    ]
  );
  logger.info("PAYMENT.RECEIPT.UPSERT_START", {
  paymentIntentId: maskId(paymentIntentId),
  orderId: maskId(orderId),
  buyerId: maskId(buyerId),
  piPaymentId: maskId(piPaymentId),
  txid: maskId(txid),

  expectedAmount,
  verifiedAmount,

  ledger: rpcPayload.ledger,
  txStatus: rpcPayload.txStatus,
});
  if (!paymentIntentId) {
  throw new Error(
    "PAYMENT_INTENT_ID_REQUIRED"
  );
}

if (!orderId) {
  throw new Error(
    "ORDER_ID_REQUIRED"
  );
}

if (!piPaymentId) {
  throw new Error(
    "PI_PAYMENT_ID_REQUIRED"
  );
}

if (!txid) {
  throw new Error(
    "TXID_REQUIRED"
  );
}
  if (
  rpcPayload.chainReference &&
  rpcPayload.chainReference !==
    txid
) {
  throw new Error(
    "CHAIN_REFERENCE_MISMATCH"
  );
}

if (
  rpcPayload.amount != null &&
  Number(rpcPayload.amount) !==
    Number(verifiedAmount)
) {
  throw new Error(
    "RECEIPT_AMOUNT_MISMATCH"
  );
}

logger.info("PAYMENT.RECEIPT.UPSERT_SUCCESS", {
  paymentIntentId: maskId(paymentIntentId),
  orderId: maskId(orderId),
  piPaymentId: maskId(piPaymentId),
  txid: maskId(txid),
});
}
catch (error) {
  logger.error("PAYMENT.RECEIPT.UPSERT_FAILED", {
  paymentIntentId: maskId(paymentIntentId),
  piPaymentId: maskId(piPaymentId),
  txid: maskId(txid),

  message:
    error instanceof Error
      ? error.message
      : String(error),
});

  throw error;
}
}
export async function linkReceiptSettlement(
  client: PoolClient,
  input: {
    paymentIntentId: string;
    escrowId: string;
    sellerCreditId: string;
  }
): Promise<void> {
  await client.query(
    `
    UPDATE payment_receipts
    SET
      escrow_id = $2,
      seller_credit_id = $3,
      updated_at = NOW()
    WHERE payment_intent_id = $1
    `,
    [
      input.paymentIntentId,
      input.escrowId,
      input.sellerCreditId,
    ]
  );

  logger.info("PAYMENT.RECEIPT_LINKED", {
  paymentIntentId: maskId(input.paymentIntentId),
  escrowId: maskId(input.escrowId),
  sellerCreditId: maskId(input.sellerCreditId),
});
}
