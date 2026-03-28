import { query } from "@/lib/db";

/* ================= MAP PI → UUID ================= */
export async function getUserIdByPiUid(
  pi_uid: string
): Promise<string | null> {
  const res = await query(
    `
    SELECT id
    FROM users
    WHERE pi_uid = $1
    LIMIT 1
    `,
    [pi_uid]
  );

  return res.rows[0]?.id ?? null;
}

/* ================= ROLE BY UUID ================= */
export async function getUserRoleByUserId(
  userId: string
): Promise<"seller" | "admin" | "customer" | null> {
  const res = await query(
    `
    SELECT role
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return res.rows[0]?.role ?? null;
}
