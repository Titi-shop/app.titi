import { query } from "@/lib/db";

/* =========================
   TYPES
========================= */

export type Region =
  | "domestic"
  | "sea"
  | "asia"
  | "europe"
  | "north_america"
  | "rest_of_world";

export type ShippingRateInput = {
  zone: Region;
  price: number;
};

type ShippingRateRow = {
  code: string;
  price: number;
};

/* =========================
   VALIDATE REGION
========================= */

function isValidRegion(value: string): value is Region {
  return [
    "domestic",
    "sea",
    "asia",
    "europe",
    "north_america",
    "rest_of_world",
  ].includes(value);
}

/* =========================
   UPSERT SHIPPING RATES
   (1 seller = 1 bộ phí ship)
========================= */

export async function upsertShippingRates({
  sellerId,
  rates,
}: {
  sellerId: string;
  rates: ShippingRateInput[];
}) {
  if (!sellerId) throw new Error("INVALID_USER");

  if (!Array.isArray(rates)) return;

  const cleanRates = rates.filter(
    (r) =>
      r &&
      typeof r.zone === "string" &&
      typeof r.price === "number" &&
      !Number.isNaN(r.price) &&
      r.price >= 0 &&
      isValidRegion(r.zone)
  );

  if (cleanRates.length === 0) return;

  /* =========================
     LẤY ZONE 1 LẦN (RULE #31)
  ========================= */

  const zoneRes = await query<{ id: string; code: string }>(
    `
    SELECT id, code
    FROM shipping_zones
    WHERE code = ANY($1)
    `,
    [cleanRates.map((r) => r.zone)]
  );

  const zoneMap = new Map(
    zoneRes.rows.map((z) => [z.code, z.id])
  );

  /* =========================
     DELETE OLD
  ========================= */

  await query(
    `
    DELETE FROM shipping_rates
    WHERE seller_id = $1
    `,
    [sellerId]
  );

  /* =========================
     INSERT NEW
  ========================= */

  for (const r of cleanRates) {
    const zoneId = zoneMap.get(r.zone);
    if (!zoneId) continue;

    await query(
      `
      INSERT INTO shipping_rates (zone_id, seller_id, price)
      VALUES ($1, $2, $3)
      `,
      [zoneId, sellerId, r.price]
    );
  }
}

/* =========================
   GET SHIPPING RATES
========================= */

export async function getShippingRatesBySeller(
  sellerId: string
): Promise<ShippingRateInput[]> {
  if (!sellerId) throw new Error("INVALID_USER");

  const { rows } = await query<ShippingRateRow>(
    `
    SELECT sz.code, sr.price
    FROM shipping_rates sr
    JOIN shipping_zones sz ON sz.id = sr.zone_id
    WHERE sr.seller_id = $1
    `,
    [sellerId]
  );

  /* =========================
     FILTER + MAP SAFE
  ========================= */

  return rows
    .filter((r) => isValidRegion(r.code))
    .map((r) => ({
      zone: r.code,
      price: Number(r.price),
    }));
}
