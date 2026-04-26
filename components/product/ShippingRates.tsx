"use client";

import { countries } from "@/data/countries";

interface Props {
  shippingRates: Record<string, number | "">;
  setShippingRates: any;

  primaryShippingCountry: string;
  setPrimaryShippingCountry: (v: string) => void;
}

export default function ShippingRates({
  shippingRates,
  setShippingRates,
}: Props) {
  const zones = [
    { key: "sea", label: "Southeast Asia" },
    { key: "asia", label: "Asia" },
    { key: "europe", label: "Europe" },
    { key: "north_america", label: "North America" },
    { key: "rest_of_world", label: "Rest of World" },
  ];

  console.log("🚚 [UI] shippingRates:", shippingRates);
  console.log("🌍 [UI] primaryShippingCountry:", primaryShippingCountry);

  return (
    <div className="space-y-3">
      <p className="font-medium">🚚 Shipping Fee</p>

      {/* PRIMARY COUNTRY SHIPPING */}
      <div className="border rounded-xl p-3 bg-gray-50 space-y-2">
  <p className="text-sm font-medium">Domestic Shipping</p>

  <select
    value={shippingRates.domestic?.countryCode || ""}
    onChange={(e) =>
      setShippingRates((prev: any) => ({
        ...prev,
        domestic: {
          ...prev.domestic,
          countryCode: e.target.value,
        },
      }))
    }
    className="border p-2 rounded w-full"
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
    value={shippingRates.domestic?.price || ""}
    onChange={(e) =>
      setShippingRates((prev: any) => ({
        ...prev,
        domestic: {
          ...prev.domestic,
          price: Number(e.target.value),
        },
      }))
    }
    className="border p-2 rounded w-full"
    placeholder="Domestic price"
  />
</div>
      </div>

      {/* INTERNATIONAL ZONES */}
      <div className="grid grid-cols-2 gap-3">
        {zones.map((z) => {
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
           [z.key]: Number(val),
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
