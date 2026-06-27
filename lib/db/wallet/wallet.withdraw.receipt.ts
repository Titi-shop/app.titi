import { query } from "@/lib/db";

import {
  getWalletWithdrawalById,
} from "@/lib/db/wallet/wallet.withdraw";

import {
  getRpcVerificationByWithdrawalId,
} from "@/lib/db/payments.rpc.a2u";

function log(
  step: string,
  data?: unknown
) {
  console.log(
    `[A2U_RECEIPT] ${step}`,
    data ?? ""
  );
}

export async function upsertWithdrawalReceipt(
  withdrawalId: string
): Promise<void> {
  try {
    log("START", {
      withdrawalId,
    });
    const withdrawal =
      await getWalletWithdrawalById(
        withdrawalId
      );
    if (!withdrawal) {
      throw new Error(
        "WITHDRAWAL_NOT_FOUND"
      );
    }
    const rpc =
      await getRpcVerificationByWithdrawalId(
        withdrawalId
      );
    console.log(
      "[A2U_RECEIPT] RPC",
      rpc
    );
    if (!rpc) {
      throw new Error(
        "RPC_LOG_NOT_FOUND"
      );
  }

  const rs =
  await query(
    `
    INSERT INTO payment_receipts (
      withdrawal_id,
      user_id,
      receipt_type,
      direction,
      pi_payment_id,
      txid,
      expected_amount,
      verified_amount,
      currency,
      sender_wallet,
      receiver_wallet,
      verification_status,
      verify_source,
      rpc_confirmed,
      rpc_ledger,
      chain_reference,
      tx_status,
      rpc_tx_status,
      rpc_stage,
      pi_memo,
      verified_at,
      completed_at,
      created_at,
      updated_at

    )
    VALUES (

      $1,

      $2,

      'APP_TO_USER',
      'APP_TO_USER',

      $3,

      $4,

      $5,
      $6,

      $7,

      $8,
      $9,

      'completed',
      'RPC',

      $10,
      $11,

      $12,

      $13,

      $14,
      $15,

      $16,

      NOW(),
      NOW(),

      NOW(),
      NOW()

    )

    ON CONFLICT (pi_payment_id)
    DO UPDATE SET
      txid = EXCLUDED.txid,
      verified_amount =
        EXCLUDED.verified_amount,
      sender_wallet =
        EXCLUDED.sender_wallet,
      receiver_wallet =
        EXCLUDED.receiver_wallet,
      rpc_confirmed =
        EXCLUDED.rpc_confirmed,

      rpc_ledger =
        EXCLUDED.rpc_ledger,
      chain_reference =
        EXCLUDED.chain_reference,
      tx_status =
        EXCLUDED.tx_status,
      rpc_tx_status =
        EXCLUDED.rpc_tx_status,
      rpc_stage =
        EXCLUDED.rpc_stage,
      pi_memo =
        EXCLUDED.pi_memo,
      verified_at = NOW(),
      completed_at = NOW(),
      updated_at = NOW()
    `,
    [

      withdrawal.id,
      withdrawal.user_id,
      withdrawal.pi_payment_id,
      rpc.txid,
      Number(withdrawal.amount),
      rpc.amount,
      withdrawal.currency,
      rpc.sender,
      rpc.receiver,
      rpc.verified,
      rpc.ledger,
      rpc.txid,
      rpc.stage,
      rpc.stage,
      rpc.memo,
    ]
  );
  console.log(
      "[A2U_RECEIPT] ROWCOUNT",
      rs.rowCount
    );
    log("DONE", {
      withdrawalId,
      txid: rpc.txid,
    });
  } catch (e) {
    console.error(
      "[A2U_RECEIPT] ERROR",
      e
    );
    throw e;
  }
}

export async function
getWithdrawalReceiptByWithdrawalId(
  withdrawalId: string
) {

  const rs =
    await query(
      `
      SELECT *
      FROM payment_receipts
      WHERE withdrawal_id = $1
      LIMIT 1
      `,
      [withdrawalId]
    );

  return rs.rows[0] ?? null;
}

export async function
getWithdrawalReceiptByPaymentId(
  piPaymentId: string
) {

  const rs =
    await query(
      `
      SELECT *
      FROM payment_receipts
      WHERE pi_payment_id = $1
      LIMIT 1
      `,
      [piPaymentId]
    );

  return rs.rows[0] ?? null;
}

export async function
getWithdrawalReceiptByTxid(
  txid: string
) {

  const rs =
    await query(
      `
      SELECT *
      FROM payment_receipts
      WHERE txid = $1
      LIMIT 1
      `,
      [txid]
    );

  return rs.rows[0] ?? null;
}
