import { query } from "@/lib/db";

export type WithdrawRequestRow = {
  id: string;
  user_id: string;
  amount: string;
  wallet_address: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_note: string | null;
};

/* =========================
   LIST
========================= */

export async function getWithdrawRequests() {
  const res = await query<WithdrawRequestRow>(
    `
    SELECT *
    FROM withdraw_requests
    ORDER BY requested_at DESC
    `
  );

  return res.rows;
}

/* =========================
   GET ONE
========================= */

export async function getWithdrawRequestById(
  id: string
) {
  const res = await query<WithdrawRequestRow>(
    `
    SELECT *
    FROM withdraw_requests
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return res.rows[0] ?? null;
}

/* =========================
   CREATE
========================= */

export async function createWithdrawRequest({
  id,
  user_id,
  amount,
  wallet_address,
}: {
  id: string;
  user_id: string;
  amount: number;
  wallet_address: string;
}) {
  await query(
    `
    INSERT INTO withdraw_requests (
      id,
      user_id,
      amount,
      wallet_address,
      status
    )
    VALUES (
      $1,$2,$3,$4,'PENDING'
    )
    `,
    [
      id,
      user_id,
      amount,
      wallet_address,
    ]
  );
}

/* =========================
   APPROVE
========================= */

export async function approveWithdrawRequest({
  id,
  adminId,
}: {
  id: string;
  adminId: string;
}) {
  await query(
    `
    UPDATE withdraw_requests
    SET
      status = 'APPROVED',
      reviewed_by = $2,
      reviewed_at = NOW()
    WHERE id = $1
    `,
    [id, adminId]
  );
}

/* =========================
   REJECT
========================= */

export async function rejectWithdrawRequest({
  id,
  adminId,
  note,
}: {
  id: string;
  adminId: string;
  note?: string;
}) {
  await query(
    `
    UPDATE withdraw_requests
    SET
      status = 'REJECTED',
      reviewed_by = $2,
      reviewed_at = NOW(),
      admin_note = $3
    WHERE id = $1
    `,
    [id, adminId, note ?? null]
  );
}
