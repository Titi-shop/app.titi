
"use client";

import { useEffect, useRef, useState } from "react";
import { ProductVariant } from "./types";

interface Props {
  variants: ProductVariant[];
  setVariants: React.Dispatch<React.SetStateAction<ProductVariant[]>>;
}

/* =========================
   HELPERS (UX SAFE)
========================= */

const parseList = (value: string): string[] =>
  value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * UX SAFE: KHÔNG ép min value
 * giống ProductForm (Number(...) only)
 */
const toNumber = (value: string): number => {
  if (value.trim() === "") return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
};

const buildName = (v: ProductVariant): string =>
  [v.option1, v.option2, v.option3].filter(Boolean).join(" - ");

/* =========================
   HYDRATE (validate logic only)
========================= */

const hydrateVariant = (v: ProductVariant): ProductVariant => {
  const price = Number(v.price ?? 0);

  const salePriceRaw =
    v.salePrice !== null && v.salePrice !== undefined
      ? Number(v.salePrice)
      : null;

  const saleEnabled = Boolean(v.saleEnabled);

  const finalSalePrice =
    saleEnabled &&
    salePriceRaw !== null &&
    salePriceRaw > 0 &&
    salePriceRaw < price
      ? salePriceRaw
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

    saleSold: Number(v.saleSold ?? 0),
    sold: Number(v.sold ?? 0),

    isActive: v.isActive !== false,
    isUnlimited: Boolean(v.isUnlimited),
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

  /* =========================
     INIT FROM EXISTING DATA
  ========================= */
  useEffect(() => {
    if (hydrated.current) return;
    if (!variants.length) return;

    hydrated.current = true;

    setLabel1(variants[0].optionLabel1 || "Color");
    setLabel2(variants[0].optionLabel2 || "Size");

    const uniq1 = [
      ...new Set(variants.map((v) => v.option1).filter(Boolean)),
    ];
    const uniq2 = [
      ...new Set(variants.map((v) => v.option2).filter(Boolean)),
    ];

    setValues1(uniq1.join(", "));
    setValues2(uniq2.join(", "));
  }, [variants]);

  /* =========================
     GENERATE VARIANTS
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
     UPDATE FIELD (NO AUTO CLAMP)
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

  const remove = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
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
            placeholder="Option 1 label"
          />
          <input
            value={values1}
            onChange={(e) => setValues1(e.target.value)}
            className="border p-2 rounded"
            placeholder="Red, Blue"
          />
          <input
            value={label2}
            onChange={(e) => setLabel2(e.target.value)}
            className="border p-2 rounded"
            placeholder="Option 2 label"
          />
          <input
            value={values2}
            onChange={(e) => setValues2(e.target.value)}
            className="border p-2 rounded"
            placeholder="S, M"
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
                      step="0.00001"
                      min="0"
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

                  <td className="p-2 space-y-1">
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
                        step="0.00001"
                        min="0"
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
                        className="border p-1 w-24 block"
                      />
                    )}
                  </td>

                  <td className="p-2">
                    <button
                      type="button"
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
