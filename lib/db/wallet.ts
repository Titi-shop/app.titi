import { query } from "@/lib/db";

export async function getWalletByUserId(userId: string) {
  const { rows } = await query(
    `
    SELECT balance
    FROM wallets
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] ?? null;
}
