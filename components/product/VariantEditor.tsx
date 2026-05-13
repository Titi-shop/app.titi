
"use client";

import { useEffect, useRef, useState } from "react";
import { ProductVariant } from "./types";

interface Props {
  variants: ProductVariant[];
  setVariants: React.Dispatch<React.SetStateAction<ProductVariant[]>>;
}

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

  const salePrice =
    v.salePrice !== null && v.salePrice !== undefined
      ? Number(v.salePrice)
      : null;

  const saleEnabled = Boolean(v.saleEnabled);

  const finalSalePrice =
    saleEnabled &&
    salePrice !== null &&
    salePrice > 0 &&
    salePrice < price
      ? salePrice
      : null;

  return {
    ...v,
    name: buildName(v),
    price,
    salePrice: finalSalePrice,
    finalPrice: finalSalePrice ?? price,
    saleEnabled,
    saleStock: Number(v.saleStock ?? 0),
  };
};

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

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">Product Variants</h2>

      {/* GENERATE */}
      <div className="border p-3 rounded bg-gray-50 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input value={label1} onChange={(e) => setLabel1(e.target.value)} />
          <input value={values1} onChange={(e) => setValues1(e.target.value)} />
          <input value={label2} onChange={(e) => setLabel2(e.target.value)} />
          <input value={values2} onChange={(e) => setValues2(e.target.value)} />
        </div>

        <button onClick={generateVariants}>
          Generate Variants
        </button>
      </div>

      {/* TABLE */}
      {variants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <tbody>
              {variants.map((v, i) => (
                <tr key={i}>
                  <td>{v.option1}</td>

                  <td>
                    <input
                      type="number"
                      step="0.00001"
                      min="0"
                      value={v.price ?? ""}
                      onChange={(e) =>
                        updateField(i, "price", toNumber(e.target.value))
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={v.stock ?? 0}
                      onChange={(e) =>
                        updateField(i, "stock", toNumber(e.target.value))
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(v.saleEnabled)}
                      onChange={(e) =>
                        updateField(i, "saleEnabled", e.target.checked)
                      }
                    />
                  </td>

                  <td>
                    <button onClick={() => remove(i)}>✕</button>
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
