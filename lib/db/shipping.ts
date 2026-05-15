"use server";

import { query } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

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
  domesticCountryCode?: string | null;
};

type ShippingRateRow = {
  product_id: string;
  zone: string;
  code: string;
  price: number;
  domestic_country_code: string | null;
};

/* =========================================================
   VALIDATE
========================================================= */

function isUUID(v: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(v);
}

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

/* =========================================================
   UPSERT SHIPPING RATES
========================================================= */

export async function upsertShippingRates({
  productId,
  rates,
}: {
  productId: string;
  rates: ShippingRateInput[];
}) {
  console.log("\n🚀 [SHIPPING][UPSERT] START", { productId, rates });

  if (!isUUID(productId)) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  if (!Array.isArray(rates) || rates.length === 0) {
    console.warn("⚠️ EMPTY RATES -> SKIP");
    return;
  }

  /* ================= CLEAN ================= */
  const cleanRates = rates.filter((r) => {
    const ok =
      r &&
      typeof r.zone === "string" &&
      typeof r.price === "number" &&
      !Number.isNaN(r.price) &&
      r.price >= 0 &&
      isValidRegion(r.zone);

    return ok;
  });

  console.log("🧼 CLEAN RATES:", cleanRates);

  /* ================= DELETE OLD ================= */
  console.log("🗑️ DELETE old shipping_rates...");

  await query(
    `
    DELETE FROM shipping_rates
    WHERE product_id = $1
    `,
    [productId]
  );

  if (cleanRates.length === 0) return;

  /* ================= ZONES ================= */
  const zones = cleanRates.map((r) => r.zone);

  const zoneRes = await query<{ id: string; code: string }>(
    `
    SELECT id, code
    FROM shipping_zones
    WHERE code = ANY($1)
    `,
    [zones]
  );

  const zoneMap = new Map(zoneRes.rows.map((z) => [z.code, z.id]));

  /* ================= BUILD INSERT ================= */
  const rows: string[] = [];
  const values: unknown[] = [];

  for (const r of cleanRates) {
    const zoneId = zoneMap.get(r.zone);
    if (!zoneId) continue;

    const isDomestic = r.zone === "domestic";

    const domesticCountry =
      isDomestic ? (r.domesticCountryCode?.trim() || null) : null;

    if (isDomestic && !domesticCountry) {
      throw new Error("DOMESTIC_COUNTRY_REQUIRED");
    }

    rows.push(
      `($${values.length + 1}, $${values.length + 2}, $${values.length + 3}, $${values.length + 4})`
    );

    values.push(productId, zoneId, r.price, domesticCountry);
  }

  if (!rows.length) return;

  /* ================= INSERT ================= */
  const result = await query(
    `
    INSERT INTO shipping_rates (
      product_id,
      zone_id,
      price,
      domestic_country_code
    )
    VALUES ${rows.join(",")}
    `,
    values
  );

  console.log("✅ SHIPPING UPSERT OK", result.rowCount);
}

/* =========================================================
   GET SHIPPING BY PRODUCT
========================================================= */

export async function getShippingRatesByProduct(productId: string) {
  if (!isUUID(productId)) throw new Error("INVALID_PRODUCT_ID");

  const { rows } = await query<ShippingRateRow>(
    `
    SELECT
      sr.product_id,
      sz.code AS zone,
      sr.price,
      sr.domestic_country_code
    FROM shipping_rates sr
    JOIN shipping_zones sz ON sz.id = sr.zone_id
    WHERE sr.product_id = $1
    `,
    [productId]
  );

  return rows
    .filter((r) => isValidRegion(r.zone))
    .map((r) => ({
      zone: r.zone as Region,
      price: Number(r.price),
      domesticCountryCode: r.domestic_country_code,
    }));
}

/* =========================================================
   GET MULTI PRODUCTS
========================================================= */

export async function getShippingRatesByProducts(productIds: string[]) {
  const validIds = productIds.filter(isUUID);
  if (!validIds.length) return [];

  const { rows } = await query<ShippingRateRow>(
    `
    SELECT
      sr.product_id,
      sz.code,
      sr.price,
      sr.domestic_country_code
    FROM shipping_rates sr
    JOIN shipping_zones sz ON sz.id = sr.zone_id
    WHERE sr.product_id = ANY($1::uuid[])
    `,
    [validIds]
  );

  return rows
    .filter((r) => isValidRegion(r.code))
    .map((r) => ({
      product_id: r.product_id,
      zone: r.code as Region,
      price: Number(r.price),
      domesticCountryCode: r.domestic_country_code,
    }));
}

/* =========================================================
   COUNTRY → ZONE
========================================================= */

export async function getZoneByCountry(countryCode: string) {
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

  const code = rows[0]?.code;
  return isValidRegion(code) ? code : null;
}

/* =========================================================
   SHIPPING RESOLVER
========================================================= */

export async function resolveShippingPrice({
  productId,
  buyerCountryCode,
}: {
  productId: string;
  buyerCountryCode: string;
}): Promise<number> {
  const rates = await getShippingRatesByProduct(productId);

  if (!rates.length) return 0;

  const buyer = buyerCountryCode.toUpperCase();

  const domestic = rates.find(
    (r) =>
      r.zone === "domestic" &&
      r.domesticCountryCode?.toUpperCase() === buyer
  );

  if (domestic) return domestic.price;

  const zone = await getZoneByCountry(buyer);

  if (zone) {
    const match = rates.find((r) => r.zone === zone);
    if (match) return match.price;
  }

  return rates.find((r) => r.zone === "rest_of_world")?.price || 0;
}

/* =========================================================
   BUYER RESOLVER
========================================================= */

export async function resolveShippingRateForBuyer({
  productId,
  buyerCountryCode,
}: {
  productId: string;
  buyerCountryCode: string;
}) {
  const rates = await getShippingRatesByProduct(productId);

  if (!rates.length) {
    throw new Error("SHIPPING_NOT_AVAILABLE");
  }

  const buyer = buyerCountryCode.toUpperCase();

  const domestic = rates.find(
    (r) =>
      r.zone === "domestic" &&
      r.domesticCountryCode?.toUpperCase() === buyer
  );

  if (domestic) {
    return { zone: "domestic" as Region, price: domestic.price };
  }

  const buyerZone = await getZoneByCountry(buyer);

  if (buyerZone) {
    const zoneRate = rates.find((r) => r.zone === buyerZone);
    if (zoneRate) {
      return { zone: buyerZone, price: zoneRate.price };
    }
  }

  const global = rates.find((r) => r.zone === "rest_of_world");

  if (global) {
    return { zone: "rest_of_world" as Region, price: global.price };
  }

  throw new Error("SHIPPING_NOT_AVAILABLE");
    }
