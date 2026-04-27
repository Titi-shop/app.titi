
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
    .filter((x) => x.length > 0);

const toSafeNumber = (value: string): number => {
  if (value.trim() === "") return 0;
  const n = Number(value);
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

  const safeSaleStock = Math.min(
    Number(v.saleStock ?? 0),
    Number(v.stock ?? 0)
  );

  return {
    ...v,
    optionValue: v.option1 ?? "",
    optionName: v.optionLabel1 ?? "",
    name: buildName(v),
    saleEnabled,
    salePrice: finalSalePrice,
    saleStock: safeSaleStock,
    saleSold: Number(v.saleSold ?? 0),
    sold: Number(v.sold ?? 0),
    finalPrice: finalSalePrice ?? price,
    isActive: v.isActive !== false,
    isUnlimited: Boolean(v.isUnlimited),
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

    const uniq1 = [...new Set(variants.map((v) => v.option1).filter(Boolean))];
    const uniq2 = [...new Set(variants.map((v) => v.option2).filter(Boolean))];

    setValues1(uniq1.join(", "));
    setValues2(uniq2.join(", "));
  }, [variants]);

  const generateVariants = () => {
    const list1 = parseList(values1);
    const list2 = parseList(values2);

    const next: ProductVariant[] = [];

    if (!list1.length) {
      setVariants([]);
      return;
    }

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
        const found = variants.find(
          (x) => x.option1 === a && !x.option2
        );

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
      prev.map((old, i) => {
        if (i !== index) return old;
        return hydrateVariant({
          ...old,
          [key]: value,
        });
      })
    );
  };

  const bulkSet = <K extends keyof ProductVariant>(
    key: K,
    value: ProductVariant[K]
  ) => {
    setVariants((prev) =>
      prev.map((old) =>
        hydrateVariant({
          ...old,
          [key]: value,
        })
      )
    );
  };

  const remove = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">Product Variants</h2>

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

      {variants.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              placeholder="Bulk price"
              className="border p-2 rounded"
              onBlur={(e) => bulkSet("price", toSafeNumber(e.target.value))}
            />

            <input
              type="number"
              placeholder="Bulk stock"
              className="border p-2 rounded"
              onBlur={(e) => bulkSet("stock", toSafeNumber(e.target.value))}
            />

            <button
              type="button"
              className="bg-orange-500 text-white rounded"
              onClick={() => bulkSet("saleEnabled", true)}
            >
              Enable Sale All
            </button>
          </div>

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
                        value={v.price ?? 0}
                        onChange={(e) =>
                          updateField(i, "price", toSafeNumber(e.target.value))
                        }
                        className="border p-1 w-24"
                      />
                    </td>

                    <td className="p-2">
                      <input
                        type="number"
                        value={v.stock ?? 0}
                        onChange={(e) =>
                          updateField(i, "stock", toSafeNumber(e.target.value))
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
                        <>
                          <input
                            type="number"
                            placeholder="Sale price"
                            value={v.salePrice ?? ""}
                            onChange={(e) =>
                              updateField(
                                i,
                                "salePrice",
                                e.target.value === ""
                                  ? null
                                  : toSafeNumber(e.target.value)
                              )
                            }
                            className="border p-1 w-24 block"
                          />

                          <input
                            type="number"
                            placeholder="Sale stock"
                            value={v.saleStock ?? 0}
                            onChange={(e) =>
                              updateField(
                                i,
                                "saleStock",
                                toSafeNumber(e.target.value)
                              )
                            }
                            className="border p-1 w-24 block"
                          />
                        </>
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
        </>
      )}
    </div>
  );
}
