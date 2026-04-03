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
  productId,
  rates,
}: {
  productId: string;
  rates: ShippingRateInput[];
}) {
  if (!productId) throw new Error("INVALID_PRODUCT");

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

  /* ================= DELETE OLD ================= */

  await query(
    `
    DELETE FROM shipping_rates
    WHERE product_id = $1
    `,
    [productId]
  );

  /* ================= INSERT NEW ================= */

  for (const r of cleanRates) {
    await query(
      `
      INSERT INTO shipping_rates (product_id, zone_code, price)
      VALUES ($1, $2, $3)
      `,
      [productId, r.zone, r.price]
    );
  }
}

/* =========================
   GET SHIPPING RATES
========================= */

export async function getShippingRatesByProduct(
  productId: string
): Promise<ShippingRateInput[]> {
  if (!productId) throw new Error("INVALID_PRODUCT");

  const { rows } = await query<{
    zone_code: string;
    price: number;
  }>(
    `
    SELECT zone_code, price
    FROM shipping_rates
    WHERE product_id = $1
    `,
    [productId]
  );

  return rows
    .filter((r) => isValidRegion(r.zone_code))
    .map((r) => ({
      zone: r.zone_code,
      price: Number(r.price),
    }));
}


export async function getZoneByCountry(
  countryCode: string
): Promise<string | null> {
  if (!countryCode) return null;

  const { rows } = await query<{ code: string }>(
    `
    SELECT sz.code
    FROM shipping_zone_countries szc
    JOIN shipping_zones sz ON sz.id = szc.zone_id
    WHERE szc.country_code = $1
    LIMIT 1
    `,
    [countryCode.toUpperCase()]
  );

  return rows[0]?.code ?? null;
}
