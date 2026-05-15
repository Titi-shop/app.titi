"use client";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { countries } from "@/data/countries";

type ShippingValue =
| number
| string
| "";

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

> ;



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
const { t } = useTranslation();

const zones: {
key: keyof ShippingRatesState;
placeholder: string;
}[] = [
{
key: "sea",
placeholder: t.shipping_sea,
},
{
key: "asia",
placeholder: t.shipping_asia,
},
{
key: "europe",
placeholder: t.shipping_europe,
},
{
key: "north_america",
placeholder:
t.shipping_north_america,
},
{
key: "rest_of_world",
placeholder:
t.shipping_rest_of_world,
},
];

const updateRate = (
key: keyof ShippingRatesState,
value: string
) => {
/* =========================
EMPTY
========================= */

if (value.trim() === "") {  
  setShippingRates((prev) => ({  
    ...prev,  
    [key]: "",  
  }));  

  return;  
}  

/* =========================  
   KEEP RAW STRING  
   tránh bị reset khi gõ:  
   0.  
   0.0  
   0.000  
========================= */  

setShippingRates((prev) => ({  
  ...prev,  
  [key]: value,  
}));

};

const normalizeRate = (
key: keyof ShippingRatesState,
value: ShippingValue
) => {
if (
value === "" ||
value === null ||
value === undefined
) {
setShippingRates((prev) => ({
...prev,
[key]: "",
}));

return;  
}  

const parsed = Number(value);  

if (Number.isNaN(parsed)) {  
  setShippingRates((prev) => ({  
    ...prev,  
    [key]: "",  
  }));  

  return;  
}  

/* =========================  
   AUTO FIX MIN PRICE  
========================= */  

if (  
  parsed > 0 &&  
  parsed < MIN_PRICE  
) {  
  setShippingRates((prev) => ({  
    ...prev,  
    [key]: MIN_PRICE,  
  }));  

  return;  
}  

setShippingRates((prev) => ({  
  ...prev,  
  [key]: parsed,  
}));

};

return (
<div className="space-y-3">
{/* TITLE */}
<p className="font-medium">
🚚 {t.shipping_fee}
</p>

{/* DOMESTIC */}  
  <div className="border rounded-xl p-3 bg-gray-50 space-y-3">  
    <select  
      value={primaryShippingCountry}  
      onChange={(e) =>  
        setPrimaryShippingCountry(  
          e.target.value  
        )  
      }  
      className="border p-2 rounded w-full"  
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

    <input  
      type="number"  
      step="0.00001"  
      min={MIN_PRICE}  
      inputMode="decimal"  
      placeholder={  
        t.domestic_price  
      }  
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
      onBlur={() =>  
        normalizeRate(  
          "domestic",  
          shippingRates.domestic  
        )  
      }  
      className="border p-2 rounded w-full"  
      required  
    />  
  </div>  

  {/* OPTIONAL ZONES */}  
  <div className="grid grid-cols-2 gap-3">  
    {zones.map((zone) => (  
      <input  
        key={zone.key}  
        type="number"  
        step="0.00001"  
        min={MIN_PRICE}  
        inputMode="decimal"  
        placeholder={  
          zone.placeholder  
        }  
        value={  
          shippingRates[  
            zone.key  
          ] === 0  
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
        onBlur={() =>  
          normalizeRate(  
            zone.key,  
            shippingRates[  
              zone.key  
            ]  
          )  
        }  
        className="border p-2 rounded w-full"  
      />  
    ))}  
  </div>  
</div>

);
            } 
