"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import type {
  ProductVariant,
} from "@/types/Product";

interface Props {
  variants: ProductVariant[];

  setVariants: React.Dispatch<
    React.SetStateAction<ProductVariant[]>
  >;
}

const MIN_PRICE = 0.00001;

/* =========================================================
   HELPERS
========================================================= */

function parseList(
  value: string
): string[] {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseNumber(
  value: string
): number | "" {
  if (!value.trim()) {
    return "";
  }

  const parsed = Number(value);

  return Number.isNaN(parsed)
    ? ""
    : parsed;
}

function normalizePrice(
  value: number | ""
): number | "" {
  if (value === "") {
    return "";
  }

  if (
    value > 0 &&
    value < MIN_PRICE
  ) {
    return MIN_PRICE;
  }

  return value;
}

function buildVariantName(
  variant: Partial<ProductVariant>
): string {
  return [
    variant.option1,
    variant.option2,
    variant.option3,
  ]
    .filter(Boolean)
    .join(" - ");
}

function calcFinalPrice(
  price: number,
  sale_price: number | null,
  sale_enabled: boolean
): number {
  const valid_sale =
    sale_enabled &&
    sale_price !== null &&
    sale_price > 0 &&
    sale_price < price;

  return valid_sale
    ? sale_price
    : price;
}

function hydrateVariant(
  variant: Partial<ProductVariant>
): ProductVariant {
  const price = Number(
    variant.price ?? 0
  );

  const sale_price =
    variant.sale_price !==
      undefined &&
    variant.sale_price !== null
      ? Number(
          variant.sale_price
        )
      : null;

  const sale_enabled =
    Boolean(
      variant.sale_enabled
    );

  const stock = Number(
    variant.stock ?? 0
  );

  const final_price =
    calcFinalPrice(
      price,
      sale_price,
      sale_enabled
    );

  return {
    id: variant.id,

    option1:
      variant.option1 ?? "",

    option2:
      variant.option2 ??
      null,

    option3:
      variant.option3 ??
      null,

    option_label1:
      variant.option_label1 ??
      "Color",

    option_label2:
      variant.option_label2 ??
      null,

    option_label3:
      variant.option_label3 ??
      null,

    name:
      variant.name ??
      buildVariantName(
        variant
      ),

    sku:
      variant.sku ?? null,

    price,

    sale_price:
      sale_enabled &&
      sale_price !== null &&
      sale_price > 0 &&
      sale_price < price
        ? sale_price
        : null,

    final_price,

    currency:
      variant.currency ??
      "PI",

    sale_enabled,

    sale_stock: Math.min(
      Number(
        variant.sale_stock ??
          0
      ),
      stock
    ),

    sale_sold: Number(
      variant.sale_sold ?? 0
    ),

    stock,

    is_unlimited:
      Boolean(
        variant.is_unlimited
      ),

    image:
      variant.image ?? "",

    is_active:
      variant.is_active !==
      false,

    sort_order: Number(
      variant.sort_order ?? 0
    ),

    sold: Number(
      variant.sold ?? 0
    ),
  };
}

/* =========================================================
   COMPONENT
========================================================= */

export default function VariantEditor({
  variants,
  setVariants,
}: Props) {
  const { t } =
    useTranslation();

  const hydrated =
    useRef(false);

  const [label1, setLabel1] =
    useState("Color");

  const [values1, setValues1] =
    useState("");

  const [label2, setLabel2] =
    useState("Size");

  const [values2, setValues2] =
    useState("");

  /* =========================================================
     HYDRATE
  ========================================================= */

  useEffect(() => {
    if (
      hydrated.current ||
      !variants.length
    ) {
      return;
    }

    hydrated.current = true;

    const first =
      variants[0];

    setLabel1(
      first.option_label1 ??
        "Color"
    );

    setLabel2(
      first.option_label2 ??
        "Size"
    );

    const unique1 = [
      ...new Set(
        variants
          .map(
            (v) => v.option1
          )
          .filter(Boolean)
      ),
    ];

    const unique2 = [
      ...new Set(
        variants
          .map(
            (v) => v.option2
          )
          .filter(Boolean)
      ),
    ];

    setValues1(
      unique1.join(", ")
    );

    setValues2(
      unique2.join(", ")
    );
  }, [variants]);

  /* =========================================================
     UPDATE FIELD
  ========================================================= */

  function updateField<
    K extends keyof ProductVariant,
  >(
    index: number,
    key: K,
    value: ProductVariant[K]
  ) {
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
  }

  /* =========================================================
     BULK SET
  ========================================================= */

  function bulkSet<
    K extends keyof ProductVariant,
  >(
    key: K,
    value: ProductVariant[K]
  ) {
    setVariants((prev) =>
      prev.map((old) =>
        hydrateVariant({
          ...old,
          [key]: value,
        })
      )
    );
  }

  /* =========================================================
     REMOVE
  ========================================================= */

  function removeVariant(
    index: number
  ) {
    setVariants((prev) =>
      prev.filter(
        (_, i) => i !== index
      )
    );
  }

  /* =========================================================
     GENERATE
  ========================================================= */

  function generateVariants() {
    const list1 =
      parseList(values1);

    const list2 =
      parseList(values2);

    if (!list1.length) {
      setVariants([]);
      return;
    }

    const next: ProductVariant[] =
      [];

    for (const option1 of list1) {
      if (list2.length) {
        for (const option2 of list2) {
          const found =
            variants.find(
              (v) =>
                v.option1 ===
                  option1 &&
                v.option2 ===
                  option2
            );

          next.push(
            hydrateVariant({
              ...found,

              option1,
              option2,

              option_label1:
                label1,

              option_label2:
                label2,
            })
          );
        }

        continue;
      }

      const found =
        variants.find(
          (v) =>
            v.option1 ===
              option1 &&
            !v.option2
        );

      next.push(
        hydrateVariant({
          ...found,

          option1,

          option2: null,

          option_label1:
            label1,

          option_label2:
            null,
        })
      );
    }

    setVariants(next);
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">
        {t.product_variants}
      </h2>

      <div className="border rounded bg-gray-50 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            value={label1}
            onChange={(e) =>
              setLabel1(
                e.target.value
              )
            }
            placeholder={
              t.option_1_label
            }
            className="border rounded p-2"
          />

          <input
            value={values1}
            onChange={(e) =>
              setValues1(
                e.target.value
              )
            }
            placeholder="Red, Blue"
            className="border rounded p-2"
          />

          <input
            value={label2}
            onChange={(e) =>
              setLabel2(
                e.target.value
              )
            }
            placeholder={
              t.option_2_label
            }
            className="border rounded p-2"
          />

          <input
            value={values2}
            onChange={(e) =>
              setValues2(
                e.target.value
              )
            }
            placeholder="S, M"
            className="border rounded p-2"
          />
        </div>

        <button
          type="button"
          onClick={
            generateVariants
          }
          className="w-full rounded bg-blue-500 py-2 text-white"
        >
          {t.generate_variants}
        </button>
      </div>
    </div>
  );
}
