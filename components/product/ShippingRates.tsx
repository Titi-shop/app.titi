"use client";

export default function ShippingRates({
  shippingRates,
  setShippingRates,
}: any) {
  const zones = [
    { key: "domestic", label: "Domestic" },
    { key: "sea", label: "SEA" },
    { key: "asia", label: "Asia" },
    { key: "europe", label: "Europe" },
    { key: "north_america", label: "North America" },
    { key: "rest_of_world", label: "Rest of World" },
  ];

  return (
    <div className="space-y-2">
      <p className="font-medium">🚚 Shipping Fee</p>

      <div className="grid grid-cols-2 gap-3">
        {zones.map((z) => (
          <input
            key={z.key}
            type="number"
            step="0.00001"
            placeholder={z.label}
            value={shippingRates[z.key] ?? ""}
            onChange={(e) =>
              setShippingRates((prev: any) => ({
                ...prev,
                [z.key]: e.target.value ? Number(e.target.value) : "",
              }))
            }
            className="border p-2 rounded"
          />
        ))}
      </div>
    </div>
  );
}
