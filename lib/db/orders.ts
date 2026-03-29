import { query } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

export type SellerOrderCount = {
  pending: number;
  confirmed: number;
  shipping: number;
  completed: number;
  returned: number;
  cancelled: number;
};

/* =========================================================
   GET — SELLER ORDER COUNTS
========================================================= */

export async function getSellerOrderCounts(
  sellerId: string
): Promise<SellerOrderCount> {
  if (!sellerId) {
    throw new Error("INVALID_SELLER_ID");
  }

  const { rows } = await query<{
    status: string;
    total: number;
  }>(
    `
    SELECT
      status,
      COUNT(DISTINCT order_id)::int AS total
    FROM order_items
    WHERE seller_id = $1
    GROUP BY status
    `,
    [sellerId]
  );

  const counts: SellerOrderCount = {
    pending: 0,
    confirmed: 0,
    shipping: 0,
    completed: 0,
    returned: 0,
    cancelled: 0,
  };

  for (const row of rows) {
    if (row.status in counts) {
      counts[row.status as keyof SellerOrderCount] = row.total;
    }
  }

  return counts;
}
