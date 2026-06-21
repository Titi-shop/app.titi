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

export async function upsertUserFromPi(
  pi_uid: string,
  username: string
): Promise<{
  id: string;
  role: string | null;
  is_admin: boolean;
}> {
  const res = await query(
    `
    INSERT INTO users (pi_uid, username)
    VALUES ($1, $2)
    ON CONFLICT (pi_uid)
    DO UPDATE SET username = EXCLUDED.username
    RETURNING id, role, is_admin
    `,
    [pi_uid, username]
  );

  return res.rows[0];
}
export async function getUserAdminFlag(
  userId: string
): Promise<boolean> {
  const res = await query(
    `
    SELECT is_admin
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return (
    res.rows[0]?.is_admin === true
  );
}
