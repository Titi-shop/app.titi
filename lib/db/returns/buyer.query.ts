import { query } from "@/lib/db";

import { isValidUuid } from "./buyer.validator";
import { toNumberSafe } from "./buyer.helper";

type DbReturn = {
  id: string;
  return_number: string;
  status: string;
  refund_amount: string;
  currency: string;
  created_at: string;
};

function error(message: string): never {
  throw new Error(message);
}

/* =====================================================
   GET RETURNS
===================================================== */

export async function getReturnsByBuyer(
  buyerId: string
): Promise<DbReturn[]> {
  if (!isValidUuid(buyerId)) {
    error("INVALID_BUYER_ID");
  }

  const { rows } = await query<DbReturn>(
    `
    SELECT
      r.id,
      r.return_number,
      r.status,
      r.refund_amount,
      r.currency,
      r.created_at,
      ri.product_name,
      ri.thumbnail
    FROM returns r

    JOIN LATERAL (
      SELECT
        product_name,
        thumbnail
      FROM return_items
      WHERE return_id = r.id
      LIMIT 1
    ) ri ON true

    WHERE r.buyer_id = $1
      AND r.deleted_at IS NULL

    ORDER BY r.created_at DESC
    `,
    [buyerId]
  );

  return rows;
}

/* =====================================================
   RETURN DETAIL
===================================================== */

export async function getReturnByIdForBuyer(
  returnId: string,
  buyerId: string
) {
  if (
    !isValidUuid(returnId) ||
    !isValidUuid(buyerId)
  ) {
    error("INVALID_INPUT");
  }

  const { rows: returnRows } =
    await query(
      `
      SELECT
        id,
        return_number,
        status,
        reason,
        description,
        evidence_images,
        refund_amount,
        created_at
      FROM returns
      WHERE id = $1
        AND buyer_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [returnId, buyerId]
    );

  const ret = returnRows[0];

  if (!ret) {
    return null;
  }

  const { rows: itemRows } =
    await query(
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

  const { rows: addressRows } =
    await query(
      `
      SELECT
        sa.recipient_name,
        sa.phone,
        sa.country,
        sa.region,
        sa.district,
        sa.ward,
        sa.address_line,
        sa.postal_code
      FROM returns r
      JOIN seller_addresses sa
        ON sa.id = r.return_address_id
      WHERE r.id = $1
      LIMIT 1
      `,
      [returnId]
    );

  const sellerAddress =
    addressRows[0] ?? null;

  const evidenceImages =
    Array.isArray(ret.evidence_images)
      ? ret.evidence_images.filter(
          (
            value: unknown
          ): value is string =>
            typeof value === "string" &&
            value.length > 5
        )
      : [];

  const firstItem =
    itemRows[0];

  return {
    id: ret.id,
    return_number:
      ret.return_number,
    status: ret.status,
    reason: ret.reason,
    description:
      ret.description,

    refund_amount:
      toNumberSafe(
        ret.refund_amount,
        "refund_amount"
      ),

    created_at:
      ret.created_at,

    product_name:
      firstItem?.product_name ??
      "",

    product_thumbnail:
      firstItem?.thumbnail ??
      "",

    evidence_images:
      evidenceImages,

    seller_address:
      sellerAddress,

    items: itemRows.map(
      (item) => ({
        product_name:
          item.product_name,
        thumbnail:
          item.thumbnail,
        quantity:
          toNumberSafe(
            item.quantity,
            "quantity"
          ),
        unit_price:
          toNumberSafe(
            item.unit_price,
            "unit_price"
          ),
      })
    ),
  };
}
