"use client";
import { countries } from "@/data/countries";

type ShippingValue = number | "";

interface ShippingRatesState {
  domestic: ShippingValue;
  sea: ShippingValue;
  asia: ShippingValue;
  europe: ShippingValue;
  north_america: ShippingValue;
  rest_of_world: ShippingValue;
}

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

const MIN_PRICE = 0.00001;

export default function ShippingRates({
  shippingRates,
  setShippingRates,
  primaryShippingCountry,
  setPrimaryShippingCountry,
}: Props) {

  const zones: {
    key: keyof ShippingRatesState;
    label: string;
  }[] = [
    {
      key: "sea",
      label: t.shipping_sea,
    },
    {
      key: "asia",
      label: t.shipping_asia,
    },
    {
      key: "europe",
      label: t.shipping_europe,
    },
    {
      key: "north_america",
      label: t.shipping_north_america,
    },
    {
      key: "rest_of_world",
      label: t.shipping_rest_of_world,
    },
  ];

  const updateRate = (
    key: keyof ShippingRatesState,
    value: string
  ) => {
    if (value.trim() === "") {
      setShippingRates((prev) => ({
        ...prev,
        [key]: "",
      }));

      return;
    }

    const parsed = Number(value);

    setShippingRates((prev) => ({
      ...prev,
      [key]: Number.isNaN(parsed)
        ? ""
        : parsed,
    }));
  };

  return (
    <div className="space-y-3">
      <p className="font-medium">
        🚚 {t.shipping_fee}
      </p>

      {/* DOMESTIC */}
      <div className="border rounded-xl p-3 bg-gray-50 space-y-2">
        <p className="text-sm font-medium text-gray-700">
          {t.domestic_country}
        </p>

        <div className="grid grid-cols-2 gap-3">
          {/* COUNTRY */}
          <select
            value={primaryShippingCountry}
            onChange={(e) =>
              setPrimaryShippingCountry(
                e.target.value
              )
            }
            className="border p-2 rounded"
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

          {/* DOMESTIC PRICE */}
          <input
            type="number"
            step="0.00001"
            min={MIN_PRICE}
            inputMode="decimal"
            placeholder={t.domestic_price}
            value={
              shippingRates.domestic === 0
                ? ""
                : shippingRates.domestic
            }
            onChange={(e) =>
              updateRate(
                "domestic",
                e.target.value
              )
            }
            className="border p-2 rounded"
            required
          />
        </div>
      </div>

      {/* OPTIONAL ZONES */}
      <div className="grid grid-cols-2 gap-3">
        {zones.map((zone) => (
          <div
            key={zone.key}
            className="space-y-1"
          >
            <p className="text-sm text-gray-600">
              {zone.label}
            </p>

            <input
              type="number"
              step="0.00001"
              min={MIN_PRICE}
              inputMode="decimal"
              placeholder=""
              value={
                shippingRates[zone.key] ===
                0
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
              className="border p-2 rounded w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
