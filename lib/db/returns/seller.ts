import { query, withTransaction } from "@/lib/db";

/* =====================================================
   HELPERS
===================================================== */

function isValidUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

/* =====================================================
   GET RETURNS
===================================================== */

export async function getReturnsBySeller(
  sellerId: string,
  status?: string | null
) {
  console.log("🚀 [DB][SELLER RETURNS]", {
    sellerId,
    status,
  });

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
   RETURN DETAIL
===================================================== */

export async function getReturnByIdForSeller(
  returnId: string,
  sellerId: string
) {
  if (!isValidUuid(returnId) || !isValidUuid(sellerId)) {
    throw new Error("INVALID_INPUT");
  }

  console.log("🚀 [DB][RETURN DETAIL]", {
    returnId,
    sellerId,
  });

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

  if (!ret) {
    return null;
  }

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

  let evidenceImages: string[] = [];

  if (Array.isArray(ret.evidence_images)) {
    evidenceImages = ret.evidence_images.filter(
      (url) =>
        typeof url === "string" &&
        url.startsWith("http")
    );
  }

  const timeline = [
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
  ].filter(Boolean);

  return {
    id: ret.id,
    return_number: ret.return_number,
    status: ret.status,
    reason: ret.reason,
    description: ret.description,

    evidence_images: evidenceImages,

    timeline,

    items: itemRows.map((item) => ({
      product_name: item.product_name,
      thumbnail: item.thumbnail,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
    })),
  };
}

/* =====================================================
   UPDATE STATUS
===================================================== */

export async function updateReturnStatusBySeller(
  returnId: string,
  sellerId: string,
  action: string
) {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{
      status: string;
      refund_amount: string;
      order_id: string;
      pi_payment_id: string | null;
      refunded_at: string | null;
    }>(
      `
      SELECT
        r.status,
        r.refund_amount,
        r.order_id,
        r.refunded_at,
        o.pi_payment_id
      FROM returns r
      JOIN orders o
        ON o.id = r.order_id
      WHERE r.id = $1
        AND r.seller_id = $2
      FOR UPDATE
      `,
      [returnId, sellerId]
    );

    const ret = rows[0];

    if (!ret) {
      throw new Error("NOT_FOUND");
    }

    /* =====================================================
       APPROVE
    ===================================================== */

    if (action === "approve") {
      if (ret.status !== "pending") {
        throw new Error("INVALID_STATE");
      }

      const { rows: addrRows } = await client.query<{
        id: string;
      }>(
        `
        SELECT id
        FROM seller_addresses
        WHERE seller_id = $1
          AND type = 'return'
          AND is_default = true
          AND is_active = true
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
       RECEIVED + REFUND
    ===================================================== */

    if (action === "received") {
      if (ret.status !== "shipping_back") {
        throw new Error("INVALID_STATE");
      }

      if (ret.refunded_at) {
        throw new Error("ALREADY_REFUNDED");
      }

      const amount = Number(ret.refund_amount);

      if (!amount || amount <= 0) {
        throw new Error("INVALID_AMOUNT");
      }

      const { rows: orderRows } = await client.query<{
        buyer_id: string;
      }>(
        `
        SELECT buyer_id
        FROM orders
        WHERE id = $1
        `,
        [ret.order_id]
      );

      const buyerId = orderRows[0]?.buyer_id;

      if (!buyerId) {
        throw new Error("BUYER_NOT_FOUND");
      }

      await client.query(
        `
        INSERT INTO wallets (
          user_id,
          balance
        )
        VALUES ($1, 0)
        ON CONFLICT (user_id)
        DO NOTHING
        `,
        [buyerId]
      );

      await client.query(
        `
        UPDATE wallets
        SET
          balance = balance + $1,
          updated_at = now()
        WHERE user_id = $2
        `,
        [amount, buyerId]
      );

      await client.query(
        `
        INSERT INTO wallet_transactions (
          user_id,
          type,
          amount,
          reference_type,
          reference_id
        )
        VALUES (
          $1,
          'credit',
          $2,
          'refund',
          $3
        )
        `,
        [buyerId, amount, returnId]
      );

      await client.query(
        `
        UPDATE returns
        SET
          status = 'refunded',
          refunded_at = now(),
          received_at = now(),
          updated_at = now()
        WHERE id = $1
        `,
        [returnId]
      );

      console.log("🟢 [REFUND INTERNAL SUCCESS]", {
        returnId,
        buyerId,
        amount,
      });

      return;
    }

    throw new Error("INVALID_ACTION");
  });
}
