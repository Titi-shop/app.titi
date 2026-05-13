"use client";

import { countries } from "@/data/countries";

type ShippingRatesState = Record<string, number | "">;

interface Props {
  shippingRates: ShippingRatesState;
  setShippingRates: (
    v: ShippingRatesState | ((prev: ShippingRatesState) => ShippingRatesState)
  ) => void;

  primaryShippingCountry: string;
  setPrimaryShippingCountry: (v: string) => void;
}

export default function ShippingRates({
  shippingRates,
  setShippingRates,
  primaryShippingCountry,
  setPrimaryShippingCountry,
}: Props) {
  const zones = [
    { key: "sea", label: "Southeast Asia" },
    { key: "asia", label: "Asia" },
    { key: "europe", label: "Europe" },
    { key: "north_america", label: "North America" },
    { key: "rest_of_world", label: "Rest of World" },
  ];

  const parseValue = (v: string) => {
    if (v.trim() === "") return "";
    const n = Number(v);
    return Number.isNaN(n) ? "" : n;
  };

  const handleChange = (key: string, value: string) => {
    setShippingRates((prev) => ({
      ...prev,
      [key]: parseValue(value),
    }));
  };

  return (
    <div className="space-y-3">
      <p className="font-medium">🚚 Shipping Fee</p>

      {/* DOMESTIC */}
      <div className="border rounded-xl p-3 bg-gray-50 space-y-2">
        <p className="text-sm font-medium text-gray-700">
          Domestic Country
        </p>

        <div className="grid grid-cols-2 gap-3">
          <select
            value={primaryShippingCountry}
            onChange={(e) => setPrimaryShippingCountry(e.target.value)}
            className="border p-2 rounded"
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            step="0.00001"
            min="0"
            placeholder="Domestic Price"
            value={shippingRates.domestic || ""}
            onChange={(e) => handleChange("domestic", e.target.value)}
            className="border p-2 rounded"
          />
        </div>
      </div>

      {/* ZONES */}
      <div className="grid grid-cols-2 gap-3">
        {zones.map((z) => (
          <input
            key={z.key}
            type="number"
            step="0.00001"
            min="0"
            placeholder={z.label}
            value={shippingRates[z.key] || ""}
            onChange={(e) => handleChange(z.key, e.target.value)}
            className="border p-2 rounded"
          />
        ))}
      </div>
    </div>
  );
}
