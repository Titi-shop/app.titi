"use client";

import { Dispatch, SetStateAction } from "react";
import { countries } from "@/data/countries";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

type ShippingRateValue = number | "";

type ShippingRatesState = Record<string, ShippingRateValue>;

interface Props {
  shippingRates: ShippingRatesState;
  setShippingRates: Dispatch<SetStateAction<ShippingRatesState>>;

  primaryShippingCountry: string;
  setPrimaryShippingCountry: (value: string) => void;
}

interface ZoneItem {
  key: string;
  label: string;
}

const MIN_PRICE = 0.00001;

const zones: ZoneItem[] = [
  {
    key: "sea",
    label: "shipping_zone_southeast_asia",
  },
  {
    key: "asia",
    label: "shipping_zone_asia",
  },
  {
    key: "europe",
    label: "shipping_zone_europe",
  },
  {
    key: "north_america",
    label: "shipping_zone_north_america",
  },
  {
    key: "rest_of_world",
    label: "shipping_zone_rest_of_world",
  },
];

const parseShippingValue = (
  value: string
): number | "" => {
  if (value === "") return "";

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return "";
  }

  return parsed;
};

const normalizeShippingValue = (
  value: number | ""
): number | "" => {
  if (value === "") {
    return "";
  }

  if (value > 0 && value < MIN_PRICE) {
    return MIN_PRICE;
  }

  return value;
};

export default function ShippingRates({
  shippingRates,
  setShippingRates,
  primaryShippingCountry,
  setPrimaryShippingCountry,
}: Props) {
  const { t } = useTranslation();

  const updateRate = (
    key: string,
    rawValue: string
  ) => {
    const parsed = parseShippingValue(rawValue);

    setShippingRates((prev) => ({
      ...prev,
      [key]: parsed,
    }));
  };

  const validateRate = (key: string) => {
    setShippingRates((prev) => ({
      ...prev,
      [key]: normalizeShippingValue(prev[key] ?? ""),
    }));
  };

  return (
    <div className="space-y-4">
      <p className="font-medium">
        🚚 {t.shipping_fee}
      </p>

      {/* DOMESTIC */}
      <div className="border rounded-xl p-3 bg-gray-50 space-y-3">
        <p className="text-sm font-medium text-gray-700">
          {t.domestic_country}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            value={primaryShippingCountry}
            onChange={(e) =>
              setPrimaryShippingCountry(
                e.target.value
              )
            }
            className="border p-2 rounded bg-white"
          >
            {countries.map((country) => (
              <option
                key={country.code}
                value={country.code}
              >
                {country.name}
              </option>
            ))}
          </select>

          <div className="space-y-1">
            <label className="text-xs text-gray-500">
              {t.domestic_shipping_price}
            </label>

            <input
              type="number"
              step="0.00001"
              min="0.00001"
              inputMode="decimal"
              placeholder="0.00001"
              value={
                shippingRates.domestic === ""
                  ? ""
                  : shippingRates.domestic
              }
              onChange={(e) =>
                updateRate(
                  "domestic",
                  e.target.value
                )
              }
              onBlur={() =>
                validateRate("domestic")
              }
              className="w-full border p-2 rounded bg-white"
            />
          </div>
        </div>
      </div>

      {/* ZONES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {zones.map((zone) => (
          <div
            key={zone.key}
            className="space-y-1"
          >
            <label className="text-sm text-gray-700">
              {t(zone.label)}
            </label>

            <input
              type="number"
              step="0.00001"
              min="0.00001"
              inputMode="decimal"
              placeholder="0.00001"
              value={
                shippingRates[zone.key] === ""
                  ? ""
                  : shippingRates[zone.key]
              }
              onChange={(e) =>
                updateRate(
                  zone.key,
                  e.target.value
                )
              }
              onBlur={() =>
                validateRate(zone.key)
              }
              className="w-full border p-2 rounded"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
