"use client";

import { countries } from "@/data/countries";

interface Props {
  shippingRates: Record<string, number | "">;
  setShippingRates: (v: any) => void;

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
    { key: "domestic", label: "Domestic (Country specific)" },
    { key: "sea", label: "Southeast Asia" },
    { key: "asia", label: "Asia" },
    { key: "europe", label: "Europe" },
    { key: "north_america", label: "North America" },
    { key: "rest_of_world", label: "Rest of World" },
  ];

  return (
    <div className="space-y-4">
      <p className="font-medium">🚚 Shipping Rates</p>

      {/* ================= DOMESTIC ================= */}
      <div className="border rounded-xl p-3 bg-gray-50 space-y-2">
        <p className="text-sm font-medium text-gray-700">
          Domestic Shipping (Primary Country)
        </p>

        <div className="grid grid-cols-2 gap-3">
          {/* COUNTRY */}
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

          {/* PRICE */}
          <input
            type="number"
            step="0.00001"
            placeholder="Domestic price"
            value={
              typeof shippingRates.domestic === "number"
                ? shippingRates.domestic
                : 0
            }
            onChange={(e) => {
              const val = Number(e.target.value);

              setShippingRates((prev: any) => ({
                ...prev,
                domestic: Number.isNaN(val) ? 0 : val,
              }));
            }}
            className="border p-2 rounded"
          />
        </div>
      </div>

      {/* ================= INTERNATIONAL ================= */}
      <div className="grid grid-cols-2 gap-3">
        {zones
          .filter((z) => z.key !== "domestic")
          .map((z) => {
            const value = shippingRates?.[z.key];

            return (
              <input
                key={z.key}
                type="number"
                step="0.00001"
                placeholder={z.label}
                value={typeof value === "number" ? value : 0}
                onChange={(e) => {
                  const val = Number(e.target.value);

                  setShippingRates((prev: any) => ({
                    ...prev,
                    [z.key]: Number.isNaN(val) ? 0 : val,
                  }));
                }}
                className="border p-2 rounded"
              />
            );
          })}
      </div>
    </div>
  );
}
