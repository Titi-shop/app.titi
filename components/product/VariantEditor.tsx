"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { ProductVariant } from "./types";
interface Props {
  variants: ProductVariant[];
  setVariants: React.Dispatch<
    React.SetStateAction<ProductVariant[]>
  >;
}

const MIN_PRICE = 0.00001;
const parseList = (
  value: string
): string[] =>
  value
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);

const parseNumberInput = (
  value: string
): number | "" => {
  if (value.trim() === "") {
    return "";
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return "";
  }

  return parsed;
};

const normalizePrice = (
  value: number | ""
): number | "" => {
  if (value === "") {
    return "";
  }

  if (value > 0 && value < MIN_PRICE) {
    return MIN_PRICE;
  }

  return value;
};

const buildName = (
  v: ProductVariant
): string =>
  [v.option1, v.option2, v.option3]
    .filter(Boolean)
    .join(" - ");

const hydrateVariant = (
  v: ProductVariant
): ProductVariant => {
  const price = Number(v.price ?? 0);

  const salePrice =
  v.salePrice !== null &&
  v.salePrice !== undefined
    ? v.salePrice
    : null;

  const saleEnabled = Boolean(
    v.saleEnabled
  );

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
    finalPrice:
      finalSalePrice ?? price,
    isActive:
      v.isActive !== false,
    isUnlimited: Boolean(
      v.isUnlimited
    ),
  };
};

export default function VariantEditor({
  variants,
  setVariants,
}: Props) {
  const { t } = useTranslation();
  const [label1, setLabel1] =
    useState("Color");
  const [values1, setValues1] =
    useState("");
  const [label2, setLabel2] =
    useState("Size");
  const [values2, setValues2] =
    useState("");
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;

    if (!variants.length) return;

    hydrated.current = true;

    setLabel1(
      variants[0].optionLabel1 ||
        "Color"
    );

    setLabel2(
      variants[0].optionLabel2 ||
        "Size"
    );

    const uniq1 = [
      ...new Set(
        variants
          .map((v) => v.option1)
          .filter(Boolean)
      ),
    ];

    const uniq2 = [
      ...new Set(
        variants
          .map((v) => v.option2)
          .filter(Boolean)
      ),
    ];

    setValues1(uniq1.join(", "));
    setValues2(uniq2.join(", "));
  }, [variants]);

  const generateVariants = () => {
    const list1 = parseList(values1);

    const list2 = parseList(values2);

    const next: ProductVariant[] =
      [];

    if (!list1.length) {
      setVariants([]);
      return;
    }

    if (list2.length) {
      for (const a of list1) {
        for (const b of list2) {
          const found = variants.find(
            (x) =>
              x.option1 === a &&
              x.option2 === b
          );

          next.push(
            hydrateVariant({
              ...found,

              option1: a,
              option2: b,

              optionLabel1: label1,
              optionLabel2: label2,

              price:
                found?.price ?? 0,

              stock:
                found?.stock ?? 0,
            })
          );
        }
      }
    } else {
      for (const a of list1) {
        const found = variants.find(
          (x) =>
            x.option1 === a &&
            !x.option2
        );

        next.push(
          hydrateVariant({
            ...found,

            option1: a,
            option2: null,

            optionLabel1: label1,
            optionLabel2: null,

            price:
              found?.price ?? 0,

            stock:
              found?.stock ?? 0,
          })
        );
      }
    }

    setVariants(next);
  };

  const updateField = <
    K extends keyof ProductVariant
  >(
    index: number,
    key: K,
    value: ProductVariant[K]
  ) => {
    setVariants((prev) =>
      prev.map((old, i) => {
        if (i !== index) {
          return old;
        }

        return hydrateVariant({
          ...old,
          [key]: value,
        });
      })
    );
  };

  const bulkSet = <
    K extends keyof ProductVariant
  >(
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
    setVariants((prev) =>
      prev.filter(
        (_, i) => i !== index
      )
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">
        {t.product_variants}
      </h2>

      {/* GENERATOR */}
      <div className="border p-3 rounded bg-gray-50 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            value={label1}
            onChange={(e) =>
              setLabel1(
                e.target.value
              )
            }
            className="border p-2 rounded"
            placeholder={t.option_1_label}
          />

          <input
            value={values1}
            onChange={(e) =>
              setValues1(
                e.target.value
              )
            }
            className="border p-2 rounded"
            placeholder="Red, Blue"
          />

          <input
            value={label2}
            onChange={(e) =>
              setLabel2(
                e.target.value
              )
            }
            className="border p-2 rounded"
            placeholder={t.option_2_label}
          />

          <input
            value={values2}
            onChange={(e) =>
              setValues2(
                e.target.value
              )
            }
            className="border p-2 rounded"
            placeholder="S, M"
          />
        </div>

        <button
          type="button"
          onClick={
            generateVariants
          }
          className="w-full bg-blue-500 text-white py-2 rounded"
        >
          {t.generate_variants}
        </button>
      </div>

      {variants.length > 0 && (
        <>
          {/* BULK */}
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              step="0.00001"
              min="0.00001"
              inputMode="decimal"
              placeholder={t.bulk_price}
              className="border p-2 rounded"
              onBlur={(e) => {
                const parsed =
                  parseNumberInput(
                    e.target.value
                  );

                bulkSet(
                  "price",
                  normalizePrice(
                    parsed
                  ) as ProductVariant["price"]
                );
              }}
            />

            <input
              type="number"
              placeholder={t.bulk_stock}
              className="border p-2 rounded"
              onBlur={(e) =>
                bulkSet(
                  "stock",
                  Number(
                    e.target.value
                  ) || 0
                )
              }
            />

            <button
              type="button"
              className="bg-orange-500 text-white rounded"
              onClick={() =>
                bulkSet(
                  "saleEnabled",
                  true
                )
              }
            >
              {t.enable_sale_all}
            </button>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2">
                    {t.variant}
                  </th>

                  <th className="p-2">
                    {t.price}
                  </th>

                  <th className="p-2">
                    {t.stock}
                  </th>

                  <th className="p-2">
                    {t.sale}
                  </th>

                  <th className="p-2"></th>
                </tr>
              </thead>

              <tbody>
                {variants.map(
                  (v, i) => (
                    <tr
                      key={v.id ?? i}
                      className="border-t"
                    >
                      {/* VARIANT */}
                      <td className="p-2">
                        {v.option1}

                        {v.option2
                          ? ` - ${v.option2}`
                          : ""}
                      </td>

                      {/* PRICE */}
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.00001"
                          min="0.00001"
                          inputMode="decimal"
                          value={
                            v.price ?? ""
                          }
                          onChange={(
                            e
                          ) => {
                            const parsed =
                              parseNumberInput(
                                e.target
                                  .value
                              );

                            updateField(
                              i,
                              "price",
                              parsed as ProductVariant["price"]
                            );
                          }}
                          onBlur={() => {
                            updateField(
                              i,
                              "price",
                              normalizePrice(
                                Number(
                                  v.price
                                )
                              ) as ProductVariant["price"]
                            );
                          }}
                          className="border p-1 w-24"
                        />
                      </td>

                      {/* STOCK */}
                      <td className="p-2">
                        <input
                          type="number"
                          value={
                            v.stock ?? 0
                          }
                          onChange={(
                            e
                          ) =>
                            updateField(
                              i,
                              "stock",
                              Number(
                                e.target
                                  .value
                              ) || 0
                            )
                          }
                          className="border p-1 w-20"
                        />
                      </td>

                      {/* SALE */}
                      <td className="p-2 space-y-1">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(
                              v.saleEnabled
                            )}
                            onChange={(
                              e
                            ) =>
                              updateField(
                                i,
                                "saleEnabled",
                                e.target
                                  .checked
                              )
                            }
                          />

                          {t.sale}
                        </label>

                        {v.saleEnabled && (
                          <>
                           <input
  type="number"
  step="0.00001"
  min="0.00001"
  inputMode="decimal"
  placeholder={t.sale_price}
  value={v.salePrice ?? ""}
  onChange={(e) => {
    updateField(
      i,
      "salePrice",
      e.target.value as ProductVariant["salePrice"]
    );
  }}
  onBlur={(e) => {
    const value = e.target.value;

    if (!value.trim()) {
      updateField(
        i,
        "salePrice",
        null
      );

      return;
    }

    const parsed = Number(value);

    updateField(
      i,
      "salePrice",
      normalizePrice(
        parsed
      ) as ProductVariant["salePrice"]
    );
  }}
  className="border p-1 w-24 block"
/>

                            <input
                              type="number"
                              placeholder={
                                t.sale_stock
                              }
                              value={
                                v.saleStock ??
                                0
                              }
                              onChange={(
                                e
                              ) =>
                                updateField(
                                  i,
                                  "saleStock",
                                  Number(
                                    e.target
                                      .value
                                  ) || 0
                                )
                              }
                              className="border p-1 w-24 block"
                            />
                          </>
                        )}
                      </td>

                      {/* REMOVE */}
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() =>
                            remove(i)
                          }
                          className="text-red-500"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
