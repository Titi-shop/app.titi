import { query } from "@/lib/db";

/* =========================================================
   TYPES (MATCH DB SCHEMA)
========================================================= */

export interface SellerAddress {
  id: string;
  seller_id: string;

  type: "return" | "warehouse" | "pickup" | "support";

  recipient_name: string | null;
  phone: string | null;

  country: string;
  province: string | null;
  district: string | null;
  ward: string | null;

  address_line: string;
  postal_code: string | null;

  is_default: boolean;
  note: string | null;

  created_at?: string;
  updated_at?: string;
}

/* =========================================================
   INPUT TYPES
========================================================= */

export type CreateSellerAddressInput = {
  seller_id: string;

  type: SellerAddress["type"];

  recipient_name?: string | null;
  phone?: string | null;

  country?: string;
  province?: string | null;
  district?: string | null;
  ward?: string | null;

  address_line: string;
  postal_code?: string | null;

  is_default?: boolean;
  note?: string | null;
};

export type UpdateSellerAddressInput = {
  type: SellerAddress["type"];

  recipient_name?: string | null;
  phone?: string | null;

  country?: string;
  province?: string | null;
  district?: string | null;
  ward?: string | null;

  address_line: string;
  postal_code?: string | null;

  is_default?: boolean;
  note?: string | null;
};

/* =========================================================
   LOG HELPERS
========================================================= */

const log = (action: string, data?: unknown) => {
  console.log(
    `[seller_addresses] ${action}`,
    data ? JSON.stringify(data) : ""
  );
};

const logError = (action: string, error: unknown) => {
  console.error(`[seller_addresses ERROR] ${action}`, error);
};

/* =========================================================
   GET
========================================================= */

export async function getSellerAddresses(
  sellerId: string
): Promise<SellerAddress[]> {
  try {
    log("GET_START", { sellerId });

    const res = await query<SellerAddress>(
      `SELECT *
       FROM seller_addresses
       WHERE seller_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [sellerId]
    );

    log("GET_SUCCESS", { count: res.rows.length });

    return res.rows;
  } catch (error) {
    logError("GET_FAIL", error);
    throw error;
  }
}

/* =========================================================
   CREATE
========================================================= */

export async function createSellerAddress(
  payload: CreateSellerAddressInput
): Promise<SellerAddress> {
  try {
    log("CREATE_START", { seller_id: payload.seller_id });

    const res = await query<SellerAddress>(
      `INSERT INTO seller_addresses (
        seller_id,
        type,
        recipient_name,
        phone,
        country,
        province,
        district,
        ward,
        address_line,
        postal_code,
        is_default,
        note
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        payload.seller_id,
        payload.type,
        payload.recipient_name ?? null,
        payload.phone ?? null,
        payload.country ?? "VN",
        payload.province ?? null,
        payload.district ?? null,
        payload.ward ?? null,
        payload.address_line,
        payload.postal_code ?? null,
        payload.is_default ?? false,
        payload.note ?? null,
      ]
    );

    const created = res.rows[0];

    log("CREATE_SUCCESS", { id: created.id });

    return created;
  } catch (error) {
    logError("CREATE_FAIL", error);
    throw error;
  }
}

/* =========================================================
   UPDATE
========================================================= */

export async function updateSellerAddress(
  id: string,
  payload: UpdateSellerAddressInput
): Promise<SellerAddress> {
  try {
    log("UPDATE_START", { id });

    const res = await query<SellerAddress>(
      `UPDATE seller_addresses
       SET type = $1,
           recipient_name = $2,
           phone = $3,
           country = $4,
           province = $5,
           district = $6,
           ward = $7,
           address_line = $8,
           postal_code = $9,
           is_default = $10,
           note = $11,
           updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        payload.type,
        payload.recipient_name ?? null,
        payload.phone ?? null,
        payload.country ?? "VN",
        payload.province ?? null,
        payload.district ?? null,
        payload.ward ?? null,
        payload.address_line,
        payload.postal_code ?? null,
        payload.is_default ?? false,
        payload.note ?? null,
        id,
      ]
    );

    const updated = res.rows[0];

    log("UPDATE_SUCCESS", { id });

    return updated;
  } catch (error) {
    logError("UPDATE_FAIL", error);
    throw error;
  }
}

/* =========================================================
   DELETE
========================================================= */

export async function deleteSellerAddress(
  id: string
): Promise<boolean> {
  try {
    log("DELETE_START", { id });

    await query(`DELETE FROM seller_addresses WHERE id = $1`, [
      id,
    ]);

    log("DELETE_SUCCESS", { id });

    return true;
  } catch (error) {
    logError("DELETE_FAIL", error);
    throw error;
  }
       }
