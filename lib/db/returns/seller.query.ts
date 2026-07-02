import { query } from "@/lib/db";
import {
  isValidUuid,
} from "./seller.validator";

import {
  buildTimeline,
} from "./seller.timeline";

import type {
  ReturnStatus,
  SellerReturnDetail,
} from "./seller.types";

/* =====================================================
   GET RETURNS LIST
===================================================== */

export async function getReturnsBySeller(
  sellerId: string,
  status?: ReturnStatus | null
) {

  if (!isValidUuid(sellerId)) {
    throw new Error("INVALID_SELLER_ID");
  }

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
      AND (
        $2::text IS NULL
        OR r.status = $2
      )
    ORDER BY r.created_at DESC
    `,
    [
      sellerId,
      status ?? null,
    ]
  );

  return rows;
}

/* =====================================================
   RETURN DETAIL
===================================================== */

export async function getReturnByIdForSeller(
  returnId: string,
  sellerId: string
): Promise<SellerReturnDetail | null> {

  if (
    !isValidUuid(returnId) ||
    !isValidUuid(sellerId)
  ) {
    throw new Error("INVALID_INPUT");
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

  const evidenceImages =
    Array.isArray(ret.evidence_images)
      ? ret.evidence_images.filter(
          (
            value: unknown
          ): value is string =>
            typeof value === "string" &&
            value.startsWith("http")
        )
      : [];

  return {
    id: ret.id,
    return_number: ret.return_number,
    status: ret.status,
    reason: ret.reason,
    description: ret.description ?? null,
    evidence_images: evidenceImages,
    timeline: buildTimeline(ret),
    items: itemRows.map(
      (item) => ({
        product_name: item.product_name,
        thumbnail: item.thumbnail,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
      })
    ),
  };
}
