
"use client";

import { useEffect, useRef, useState } from "react";
import { ProductVariant } from "./types";

interface Props {
  variants: ProductVariant[];
  setVariants: React.Dispatch<React.SetStateAction<ProductVariant[]>>;
}

const MIN_PRICE = 0.00001;

/* =========================
   HELPERS
========================= */

const parseList = (value: string): string[] =>
  value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const toNumber = (v: string): number => {
  if (v.trim() === "") return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const buildName = (v: ProductVariant): string =>
  [v.option1, v.option2, v.option3].filter(Boolean).join(" - ");

const hydrateVariant = (v: ProductVariant): ProductVariant => {
  const price = Number(v.price ?? 0);

  const salePriceRaw =
    v.salePrice !== null && v.salePrice !== undefined
      ? Number(v.salePrice)
      : null;

  const salePrice = salePriceRaw;

  const saleEnabled = Boolean(v.saleEnabled);

  const finalSalePrice =
    saleEnabled &&
    salePrice !== null &&
    salePrice > 0 &&
    salePrice < price
      ? salePrice
      : null;

  const safeSaleStock = Math.min(
    Number(v.saleStock ?? 0),
    Number(v.stock ?? 0)
  );

  return {
    ...v,
    name: buildName(v),
    price,
    salePrice: finalSalePrice,
    finalPrice: finalSalePrice ?? price,
    saleEnabled,
    saleStock: safeSaleStock,
  };
};

/* =========================
   COMPONENT
========================= */

export default function VariantEditor({
  variants,
  setVariants,
}: Props) {
  const [label1, setLabel1] = useState("Color");
  const [values1, setValues1] = useState("");

  const [label2, setLabel2] = useState("Size");
  const [values2, setValues2] = useState("");

  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    if (!variants.length) return;

    hydrated.current = true;

    setLabel1(variants[0].optionLabel1 || "Color");
    setLabel2(variants[0].optionLabel2 || "Size");

    setValues1(
      [...new Set(variants.map((v) => v.option1).filter(Boolean))].join(", ")
    );

    setValues2(
      [...new Set(variants.map((v) => v.option2).filter(Boolean))].join(", ")
    );
  }, [variants]);

  /* =========================
     GENERATE
  ========================= */

  const generateVariants = () => {
    const list1 = parseList(values1);
    const list2 = parseList(values2);

    if (!list1.length) {
      setVariants([]);
      return;
    }

    const next: ProductVariant[] = [];

    if (list2.length) {
      for (const a of list1) {
        for (const b of list2) {
          const found = variants.find(
            (x) => x.option1 === a && x.option2 === b
          );

          next.push(
            hydrateVariant({
              ...found,
              option1: a,
              option2: b,
              optionLabel1: label1,
              optionLabel2: label2,
              price: found?.price ?? 0,
              stock: found?.stock ?? 0,
            })
          );
        }
      }
    } else {
      for (const a of list1) {
        const found = variants.find((x) => x.option1 === a);

        next.push(
          hydrateVariant({
            ...found,
            option1: a,
            option2: null,
            optionLabel1: label1,
            optionLabel2: null,
            price: found?.price ?? 0,
            stock: found?.stock ?? 0,
          })
        );
      }
    }

    setVariants(next);
  };

  /* =========================
     UPDATE
  ========================= */

  const updateField = <K extends keyof ProductVariant>(
    index: number,
    key: K,
    value: ProductVariant[K]
  ) => {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === index
          ? hydrateVariant({
              ...v,
              [key]: value,
            })
          : v
      )
    );
  };

  const bulkSet = <K extends keyof ProductVariant>(
    key: K,
    value: ProductVariant[K]
  ) => {
    setVariants((prev) =>
      prev.map((v) =>
        hydrateVariant({
          ...v,
          [key]: value,
        })
      )
    );
  };

  const remove = (i: number) => {
    setVariants((prev) => prev.filter((_, idx) => idx !== i));
  };

  /* =========================
     UI
  ========================= */

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">Product Variants</h2>

      {/* GENERATE */}
      <div className="border p-3 rounded bg-gray-50 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            value={label1}
            onChange={(e) => setLabel1(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            value={values1}
            onChange={(e) => setValues1(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            value={label2}
            onChange={(e) => setLabel2(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            value={values2}
            onChange={(e) => setValues2(e.target.value)}
            className="border p-2 rounded"
          />
        </div>

        <button
          type="button"
          onClick={generateVariants}
          className="w-full bg-blue-500 text-white py-2 rounded"
        >
          Generate Variants
        </button>
      </div>

      {/* TABLE */}
      {variants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2">Variant</th>
                <th className="p-2">Price</th>
                <th className="p-2">Stock</th>
                <th className="p-2">Sale</th>
                <th className="p-2"></th>
              </tr>
            </thead>

            <tbody>
              {variants.map((v, i) => (
                <tr key={v.id ?? i} className="border-t">
                  <td className="p-2">
                    {v.option1}
                    {v.option2 ? ` - ${v.option2}` : ""}
                  </td>

                  <td className="p-2">
                    <input
                      type="number"
                      min={0}
                      step={MIN_PRICE}
                      value={v.price ?? ""}
                      onChange={(e) =>
                        updateField(i, "price", toNumber(e.target.value))
                      }
                      className="border p-1 w-24"
                    />
                  </td>

                  <td className="p-2">
                    <input
                      type="number"
                      value={v.stock ?? 0}
                      onChange={(e) =>
                        updateField(i, "stock", toNumber(e.target.value))
                      }
                      className="border p-1 w-20"
                    />
                  </td>

                  <td className="p-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(v.saleEnabled)}
                        onChange={(e) =>
                          updateField(i, "saleEnabled", e.target.checked)
                        }
                      />
                      Sale
                    </label>

                    {v.saleEnabled && (
                      <input
                        type="number"
                        min={0}
                        step={MIN_PRICE}
                        placeholder="Sale price"
                        value={v.salePrice ?? ""}
                        onChange={(e) =>
                          updateField(
                            i,
                            "salePrice",
                            e.target.value === ""
                              ? null
                              : toNumber(e.target.value)
                          )
                        }
                        className="border p-1 w-24 mt-1"
                      />
                    )}
                  </td>

                  <td className="p-2">
                    <button
                      onClick={() => remove(i)}
                      className="text-red-500"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
