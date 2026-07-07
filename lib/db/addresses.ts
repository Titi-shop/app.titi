import { query } from "@/lib/db";
import {
  logger,
  maskId,
} from "@/lib/logger";
/* =========================
   GET ADDRESSES
========================= */
export async function getAddressesByUser(
  userId: string
) {
   logger.info(
  "ADDRESS.GET_ALL.START",
  {
    userId: maskId(userId),
  }
);
  const res = await query(
    `
    SELECT *
    FROM addresses
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );
logger.info(
  "ADDRESS.GET_ALL.SUCCESS",
  {
    count: res.rows.length,
  }
);
  return res.rows;
}

/* =========================
   CREATE ADDRESS
========================= */
export async function createAddress(
  userId: string,
  data: {
    full_name: string;
    phone: string;
    country: string;
    region: string;
    district?: string | null;
    ward?: string | null;
    address_line: string;
    postal_code: string | null;
    label: string;
  }
) {
   try {
   logger.info(
  "ADDRESS.CREATE.START",
  {
    userId: maskId(userId),
  }
);
  await query(
    `UPDATE addresses SET is_default = false WHERE user_id = $1`,
    [userId]
  );

  const res = await query(
    `
    INSERT INTO addresses (
      user_id,
      full_name,
      phone,
      country,
      region,
      district,
      ward,
      address_line,
      postal_code,
      label,
      is_default
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
    RETURNING *
    `,
    [
      userId,
      data.full_name,
      data.phone,
      data.country,
      data.region,
      data.district ?? null,
      data.ward ?? null,
      data.address_line,
      data.postal_code,
      data.label,
    ]
  );
const address = res.rows[0];

logger.info(
  "ADDRESS.CREATE.SUCCESS",
  {
    addressId: maskId(address.id),
  }
);

return address;
      } catch (error) {

    logger.error(

      "ADDRESS.CREATE.ERROR",

      {

        message:

          error instanceof Error

            ? error.message

            : "UNKNOWN_ERROR",

      }

    );

    throw error;

  }
  
}

/* =========================
   SET DEFAULT
========================= */
export async function setDefaultAddress(
  userId: string,
  addressId: string
) {
  logger.info(
    "ADDRESS.SET_DEFAULT.START",
    {
      userId: maskId(userId),
      addressId: maskId(addressId),
    }
  );

  await query(
    `UPDATE addresses
     SET is_default = false
     WHERE user_id = $1`,
    [userId]
  );

  await query(
    `
    UPDATE addresses
    SET is_default = true
    WHERE id = $1
      AND user_id = $2
    `,
    [addressId, userId]
  );

  logger.info(
    "ADDRESS.SET_DEFAULT.SUCCESS",
    {
      addressId: maskId(addressId),
    }
  );
}
/* =========================
   DELETE
========================= */
export async function deleteAddress(
  userId: string,
  addressId: string
) {
   logger.info(
  "ADDRESS.DELETE.START",
  {
    userId: maskId(userId),
    addressId: maskId(addressId),
  }
);
  await query(
    `
    DELETE FROM addresses
    WHERE id = $1 AND user_id = $2
    `,
    [addressId, userId]
  );
}
logger.info(
  "ADDRESS.DELETE.SUCCESS",
  {
    addressId: maskId(addressId),
  }
);
}
/* =========================
   UPDATE ADDRESS
========================= */

interface UpdateAddressPayload {
  full_name: string;
  phone: string;
  country: string;

  region: string;
  district?: string | null;
  ward?: string | null;

  address_line: string;
  postal_code?: string | null;
  label?: "home" | "office" | "other";
}

export async function updateAddress(
  userId: string,
  id: string,
  data: UpdateAddressPayload
) {
   logger.info(
  "ADDRESS.UPDATE.START",
  {
    userId: maskId(userId),
    addressId: maskId(id),
  }
);
  const res = await query(
    `
    UPDATE addresses
    SET
      full_name = $1,
      phone = $2,
      country = $3,
      region = $4,
      district = $5,
      ward = $6,
      address_line = $7,
      postal_code = $8,
      label = $9,
      updated_at = NOW()
    WHERE id = $10
      AND user_id = $11
    RETURNING *
    `,
    [
      data.full_name,
      data.phone,
      data.country,
      data.region,
      data.district ?? null,
      data.ward ?? null,
      data.address_line,
      data.postal_code ?? null,
      data.label ?? "home",
      id,
      userId,
    ]
  );
const address = res.rows[0] ?? null;

logger.info(
  "ADDRESS.UPDATE.SUCCESS",
  {
    found: address !== null,
    addressId: maskId(id),
  }
);

return address;
}
export async function getAddressById(
  userId: string,
  addressId: string
) {
   logger.info(
  "ADDRESS.GET.START",
  {
    userId: maskId(userId),
    addressId: maskId(addressId),
  }
);
  const res = await query(
    `
    SELECT *
    FROM addresses
    WHERE id = $1
      AND user_id = $2
    LIMIT 1
    `,
    [addressId, userId]
  );
const address = res.rows[0] ?? null;

logger.info(
  "ADDRESS.GET.SUCCESS",
  {
    found: address !== null,
    addressId: maskId(addressId),
  }
);

return address;
}
