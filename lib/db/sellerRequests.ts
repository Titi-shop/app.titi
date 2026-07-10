import { query } from "@/lib/db";
import { logger, maskId } from "@/lib/logger";

type SellerRequestStatus =
  | "pending"
  | "approved"
  | "rejected";

export interface SellerRequest {
  id: string;
  user_id: string;

  username: string;
  shop_name: string;
  shop_slug: string;
  shop_description: string | null;

  shop_logo: string | null;
  shop_banner: string | null;

  phone: string | null;
  email: string | null;

  identity_number: string | null;
  identity_document_url: string | null;

  status: SellerRequestStatus;

  admin_note: string | null;
  rejection_reason: string | null;

  reviewed_by: string | null;
  reviewed_at: string | null;

  request_key: string | null;
  ip_address: string | null;
  user_agent: string | null;

  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function isUUID(id: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(id);
}

function requireUUID(id: string, name: string) {
  if (!isUUID(id)) {
    logger.warn("[SELLER_REQUEST] INVALID_UUID", {
      field: name,
      value: maskId(id),
    });

    throw new Error("INVALID_UUID");
  }
}
/* ================= GET PENDING REQUEST ================= */

export async function getPendingSellerRequest(
  userId: string
): Promise<SellerRequest | null> {
  requireUUID(userId, "userId");

  logger.info("[SELLER_REQUEST] GET_PENDING", {
    userId: maskId(userId),
  });

  try {
    const res = await query(
      `
      SELECT *
      FROM seller_requests
      WHERE user_id = $1
        AND status = 'pending'
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId]
    );

    logger.info("[SELLER_REQUEST] GET_PENDING_OK", {
      userId: maskId(userId),
      found: res.rowCount === 1,
    });

    return (res.rows[0] as SellerRequest) ?? null;
  } catch (err) {
    logger.error("[SELLER_REQUEST] GET_PENDING_ERROR", {
      userId: maskId(userId),
      code: err instanceof Error ? err.name : "UNKNOWN",
    });

    throw err;
  }
}
/* ================= CREATE REQUEST ================= */

export async function createSellerRequest(
  userId: string
): Promise<SellerRequest> {
  requireUUID(userId, "userId");

  logger.info("[SELLER_REQUEST] CREATE", {
    userId: maskId(userId),
  });

  try {
    const res = await query(
      `
      INSERT INTO seller_requests (
        user_id,
        username,
        shop_name,
        shop_slug,
        shop_description,
        shop_logo,
        shop_banner,
        phone,
        email,
        status,
        created_at,
        updated_at
      )
      SELECT
        u.id,
        u.username,
        COALESCE(p.shop_name, ''),
        COALESCE(p.shop_slug, ''),
        COALESCE(p.shop_description, ''),
        p.avatar_url,
        p.shop_banner,
        p.phone,
        p.email,
        'pending',
        NOW(),
        NOW()
      FROM users u
      LEFT JOIN user_profiles p
        ON p.user_id = u.id
      WHERE u.id = $1
      RETURNING *
      `,
      [userId]
    );

    if (res.rowCount !== 1) {
      throw new Error("CREATE_FAILED");
    }

    logger.info("[SELLER_REQUEST] CREATE_OK", {
      requestId: maskId(res.rows[0].id),
      userId: maskId(userId),
    });

    return res.rows[0] as SellerRequest;

  } catch (err) {
    logger.error("[SELLER_REQUEST] CREATE_ERROR", {
      userId: maskId(userId),
      code: err instanceof Error ? err.name : "UNKNOWN",
    });

    throw err;
  }
}
