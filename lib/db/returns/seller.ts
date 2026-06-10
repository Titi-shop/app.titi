import { query, withTransaction } from "@/lib/db";
/* =====================================================
   TYPES (V7 STRICT)
===================================================== */

type ReturnStatus =
  | "pending"
  | "approved"
  | "shipping_back"
  | "received"
  | "refunded"
  | "rejected";

type TimelineItem = {
  key: string;
  label: string;
  time: string;
};

type ReturnItem = {
  product_name: string;
  thumbnail: string;
  quantity: number;
  unit_price: number;
};

type SellerReturnDetail = {
  id: string;
  return_number: string;
  status: ReturnStatus;
  reason: string;
  description: string | null;
  evidence_images: string[];
  timeline: TimelineItem[];
  items: ReturnItem[];
};

/* =====================================================
   HELPERS
===================================================== */

function isValidUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

/* =====================================================
   GET RETURNS LIST
===================================================== */

export async function getReturnsBySeller(
  sellerId: string,
  status?: string | null
) {
  const { rows } = await query(
    `
    SELECT
      r.id,
      r.return_number,
      r.status,
      r.created_at,
      ri.product_name,
      ri.thumbnail,
      ri.quantity
    FROM returns r
    JOIN return_items ri
      ON ri.return_id = r.id
    WHERE r.seller_id = $1
      AND r.deleted_at IS NULL
      AND ($2::text IS NULL OR r.status = $2)
    ORDER BY r.created_at DESC
    `,
    [sellerId, status ?? null]
  );

  return rows;
}

/* =====================================================
   RETURN DETAIL (SELLER)
===================================================== */
export async function getReturnByIdForSeller(
  returnId: string,
  sellerId: string
): Promise<SellerReturnDetail | null> {
  if (!isValidUuid(returnId) || !isValidUuid(sellerId)) {
    throw new Error("INVALID_INPUT");
  }

  const { rows: returnRows } = await query(
    `
    SELECT
      id,
      return_number,
      status,
      reason,
      description,
      evidence_images,
      created_at,
      approved_at,
      rejected_at,
      shipped_back_at,
      received_at,
      refunded_at
    FROM returns
    WHERE id = $1
      AND seller_id = $2
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [returnId, sellerId]
  );

  const ret = returnRows[0];
  if (!ret) return null;

  const { rows: itemRows } = await query(
    `
    SELECT
      product_name,
      thumbnail,
      quantity,
      unit_price
    FROM return_items
    WHERE return_id = $1
    `,
    [returnId]
  );

  const evidence_images: string[] = Array.isArray(ret.evidence_images)
    ? ret.evidence_images.filter(
        (u: unknown): u is string =>
          typeof u === "string" &&
          u.startsWith("http")
      )
    : [];

  const timeline: TimelineItem[] = [
    {
      key: "created",
      label: "Request created",
      time: ret.created_at,
    },
    ret.approved_at && {
      key: "approved",
      label: "Seller approved",
      time: ret.approved_at,
    },
    ret.rejected_at && {
      key: "rejected",
      label: "Rejected",
      time: ret.rejected_at,
    },
    ret.shipped_back_at && {
      key: "shipping_back",
      label: "Buyer shipped back",
      time: ret.shipped_back_at,
    },
    ret.received_at && {
      key: "received",
      label: "Seller received",
      time: ret.received_at,
    },
    ret.refunded_at && {
      key: "refunded",
      label: "Refund completed",
      time: ret.refunded_at,
    },
  ].filter(Boolean) as TimelineItem[];

  return {
    id: ret.id,
    return_number: ret.return_number,
    status: ret.status,
    reason: ret.reason,
    description: ret.description ?? null,
    evidence_images,
    timeline,
    items: itemRows.map((i) => ({
      product_name: i.product_name,
      thumbnail: i.thumbnail,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
    })),
  };
}

/* =====================================================
   UPDATE STATUS (SELLER)
===================================================== */

export async function updateReturnStatusBySeller(
  returnId: string,
  sellerId: string,
  action: "approve" | "reject" | "received"
) {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{
      status: ReturnStatus;
      refund_amount: string;
      order_id: string;
    }>(
      `
      SELECT
        status,
        refund_amount,
        order_id
      FROM returns
      WHERE id = $1
        AND seller_id = $2
      FOR UPDATE
      `,
      [returnId, sellerId]
    );

    const ret = rows[0];
    if (!ret) throw new Error("NOT_FOUND");

    /* =====================================================
       APPROVE
    ===================================================== */

    if (action === "approve") {
      if (ret.status !== "pending") {
        throw new Error("INVALID_STATE");
      }

      const { rows: addrRows } = await client.query<{ id: string }>(
        `
        SELECT id
        FROM seller_addresses
        WHERE seller_id = $1
          AND is_active = true
        ORDER BY
          CASE
            WHEN type = 'return' THEN 1
            WHEN type = 'pickup' THEN 2
            ELSE 3
          END
        LIMIT 1
        `,
        [sellerId]
      );

      const returnAddressId = addrRows[0]?.id;
      if (!returnAddressId) {
        throw new Error("RETURN_ADDRESS_REQUIRED");
      }

      await client.query(
        `
        UPDATE returns
        SET
          status = 'approved',
          return_address_id = $1,
          approved_at = now(),
          updated_at = now()
        WHERE id = $2
        `,
        [returnAddressId, returnId]
      );

      return;
    }

    /* =====================================================
       RECEIVED + REFUND (FIXED V7 WALLET SCHEMA)
    ===================================================== */

if (action === "received") {
  if (ret.status !== "shipping_back") {
    throw new Error("INVALID_STATE");
  }

  const amount = Number(ret.refund_amount);
  if (!amount || amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const { rows: orderRows } = await client.query<{ buyer_id: string }>(
    `
    SELECT buyer_id
    FROM orders
    WHERE id = $1
    `,
    [ret.order_id]
  );

  const buyerId = orderRows[0]?.buyer_id;
  if (!buyerId) throw new Error("BUYER_NOT_FOUND");

  /* UPSERT WALLET */
  await client.query(
    `
    INSERT INTO wallets (user_id, balance)
    VALUES ($1, 0)
    ON CONFLICT (user_id)
    DO NOTHING
    `,
    [buyerId]
  );

  /* CREDIT BALANCE */
  await client.query(
    `
    UPDATE wallets
    SET balance = balance + $1,
        updated_at = now()
    WHERE user_id = $2
    `,
    [amount, buyerId]
  );

  /* JOURNAL (V7 LEDGER) */
  await client.query(
    `
    INSERT INTO wallet_journal (
      owner_id,
      owner_type,
      entry_type,
      direction,
      amount,
      currency,
      note,
      ref_id,
      ref_table
    )
    VALUES (
      $1,
      'BUYER',
      'BUYER_REFUND',
      'CREDIT',
      $2,
      'PI',
      'Return refund',
      $3,
      'returns'
    )
    `,
    [buyerId, amount, returnId]
  );

  /* UPDATE RETURN */
  await client.query(
    `
    UPDATE returns
    SET status = 'refunded',
        refunded_at = now(),
        received_at = now(),
        updated_at = now()
    WHERE id = $1
    `,
    [returnId]
  );

  return;
}
