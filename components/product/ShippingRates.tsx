"use client";

import type React from "react";

import { countries } from "@/data/countries";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import type {
  ShippingRatesState,
  ShippingZone,
} from "./types";

/* =========================================================
   TYPES
========================================================= */

interface Props {
  shippingRates: ShippingRatesState;

  setShippingRates: React.Dispatch<
    React.SetStateAction<ShippingRatesState>
  >;

  primaryShippingCountry: string;

  setPrimaryShippingCountry: (
    value: string
  ) => void;
}

type ZoneItem = {
  key: Exclude<
    ShippingZone,
    "domestic"
  >;

  labelKey:
    | "sea"
    | "asia"
    | "europe"
    | "northAmerica"
    | "restOfWorld";
};

/* =========================================================
   ZONES
========================================================= */

const zones: ZoneItem[] = [
  {
    key: "sea",
    labelKey: "sea",
  },
  {
    key: "asia",
    labelKey: "asia",
  },
  {
    key: "europe",
    labelKey: "europe",
  },
  {
    key: "north_america",
    labelKey: "northAmerica",
  },
  {
    key: "rest_of_world",
    labelKey: "restOfWorld",
  },
];

/* =========================================================
   COMPONENT
========================================================= */

export default function ShippingRates({
  shippingRates,
  setShippingRates,
  primaryShippingCountry,
  setPrimaryShippingCountry,
}: Props) {
  const { t } = useTranslation();

  const updateRate = (
    key: keyof ShippingRatesState,
    value: string
  ) => {
    setShippingRates((prev) => ({
      ...prev,

      [key]:
        value === ""
          ? ""
          : Number(value),
    }));
  };

  return (
    <div className="space-y-3">
      {/* TITLE */}
      <p className="font-medium">
        {t("product.shippingFee")}
      </p>

      {/* DOMESTIC */}
      <div className="space-y-2 rounded-xl border bg-gray-50 p-3">
        <p className="text-sm font-medium text-gray-700">
          {t("product.domesticCountry")}
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* COUNTRY */}
          <select
            value={primaryShippingCountry}
            onChange={(e) =>
              setPrimaryShippingCountry(
                e.target.value
              )
            }
            className="rounded border p-2"
          >
            <option value="">
              {t(
                "product.domesticCountry"
              )}
            </option>

            {countries.map((country) => (
              <option
                key={country.code}
                value={country.code}
              >
                {country.name}
              </option>
            ))}
          </select>

          {/* DOMESTIC PRICE */}
          <input
            type="number"
            inputMode="decimal"
            step="0.00001"
            min="0"
            placeholder={t(
              "product.domesticPrice"
            )}
            value={
              shippingRates.domestic ===
              ""
                ? ""
                : shippingRates.domestic
            }
            onChange={(e) =>
              updateRate(
                "domestic",
                e.target.value
              )
            }
            className="rounded border p-2"
          />
        </div>
      </div>

      {/* ZONES */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {zones.map((zone) => (
          <div
            key={zone.key}
            className="space-y-1"
          >
            {/* LABEL */}
            <p className="text-sm text-gray-600">
              {t(
                `product.${zone.labelKey}`
              )}
            </p>

            {/* INPUT */}
            <input
              type="number"
              inputMode="decimal"
              step="0.00001"
              min="0"
              placeholder={t(
                `product.${zone.labelKey}`
              )}
              value={
                shippingRates[zone.key] ===
                ""
                  ? ""
                  : shippingRates[
                      zone.key
                    ]
              }
              onChange={(e) =>
                updateRate(
                  zone.key,
                  e.target.value
                )
              }
              className="w-full rounded border p-2"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
