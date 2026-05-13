"use client";

import { useEffect, useState } from "react";

import type { ProductPayload, ProductVariant } from "./types";

/* =========================================================
   TYPES
========================================================= */

export type ShippingRatesState = {
  domestic: number | "";
  sea: number | "";
  asia: number | "";
  europe: number | "";
  north_america: number | "";
  rest_of_world: number | "";
};

type ShippingRateItem = {
  zone: string;
  price: number;
  domesticCountryCode?: string | null;
};

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_SHIPPING: ShippingRatesState = {
  domestic: "",
  sea: "",
  asia: "",
  europe: "",
  north_america: "",
  rest_of_world: "",
};

/* =========================================================
   HELPERS
========================================================= */

const normalizeNumber = (
  value: unknown,
  fallback = 0
): number => {
  const n = Number(value);

  if (Number.isNaN(n)) {
    return fallback;
  }

  return n;
};

const normalizePriceInput = (
  value: unknown
): number | "" => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  const n = Number(value);

  if (Number.isNaN(n)) {
    return "";
  }

  return n;
};

/* =========================================================
   VARIANT NORMALIZE
========================================================= */

function normalizeInitVariants(
  input: ProductVariant[] | undefined
): ProductVariant[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((v, index) => {
    const price = normalizeNumber(v.price);

    const salePrice =
      v.salePrice !== null &&
      v.salePrice !== undefined
        ? normalizeNumber(v.salePrice)
        : null;

    const saleEnabled = Boolean(v.saleEnabled);

    const finalPrice =
      saleEnabled &&
      salePrice !== null &&
      salePrice >= 0.00001 &&
      salePrice < price
        ? salePrice
        : price;

    return {
      id: v.id,

      option1: v.option1 ?? "",
      option2: v.option2 ?? null,
      option3: v.option3 ?? null,

      optionLabel1: v.optionLabel1 ?? null,
      optionLabel2: v.optionLabel2 ?? null,
      optionLabel3: v.optionLabel3 ?? null,

      optionValue: v.optionValue ?? v.option1 ?? "",
      optionName:
        v.optionName ??
        v.optionLabel1 ??
        "",

      name:
        v.name ??
        [v.option1, v.option2, v.option3]
          .filter(Boolean)
          .join(" - "),

      sku: v.sku ?? null,

      price,

      salePrice:
        saleEnabled &&
        salePrice !== null &&
        salePrice >= 0.00001 &&
        salePrice < price
          ? salePrice
          : null,

      finalPrice,

      saleEnabled,

      saleStock: Math.min(
        normalizeNumber(v.saleStock),
        normalizeNumber(v.stock)
      ),

      saleSold: normalizeNumber(v.saleSold),

      stock: normalizeNumber(v.stock),

      isUnlimited: Boolean(v.isUnlimited),

      image: v.image ?? "",

      isActive: v.isActive !== false,

      sortOrder: normalizeNumber(
        v.sortOrder,
        index
      ),

      sold: normalizeNumber(v.sold),
    };
  });
}

/* =========================================================
   HOOK
========================================================= */

export function useProductForm(
  initialData?: ProductPayload
) {
  /* ================= BASIC ================= */

  const [id, setId] = useState<string>("");
  const [name, setName] =
    useState<string>("");

  const [price, setPrice] = useState<
    number | ""
  >("");

  const [categoryId, setCategoryId] =
    useState<string>("");

  const [description, setDescription] =
    useState<string>("");

  const [images, setImages] = useState<
    string[]
  >([]);

  /* ================= DETAIL ================= */

  const [detail, setDetail] =
    useState<string>("");

  /* ================= SALE ================= */

  const [saleEnabled, setSaleEnabled] =
    useState<boolean>(false);

  const [salePrice, setSalePrice] =
    useState<number | "">("");

  const [saleStock, setSaleStock] =
    useState<number>(0);

  const [saleStart, setSaleStart] =
    useState<string>("");

  const [saleEnd, setSaleEnd] =
    useState<string>("");

  /* ================= STOCK ================= */

  const [stock, setStock] = useState<
    number | ""
  >(1);

  /* ================= STATUS ================= */

  const [isActive, setIsActive] =
    useState<boolean>(true);

  /* ================= VARIANTS ================= */

  const [variants, setVariants] =
    useState<ProductVariant[]>([]);

  /* ================= SHIPPING ================= */

  const [shippingRates, setShippingRates] =
    useState<ShippingRatesState>(
      DEFAULT_SHIPPING
    );

  const [
    primaryShippingCountry,
    setPrimaryShippingCountry,
  ] = useState<string>("");

  /* =========================================================
     INIT DATA
  ========================================================= */

  useEffect(() => {
    if (!initialData) {
      return;
    }

    /* ================= BASIC ================= */

    setId(initialData.id || "");

    setName(initialData.name || "");

    setPrice(
      normalizePriceInput(initialData.price)
    );

    setCategoryId(
      String(initialData.categoryId || "")
    );

    setDescription(
      initialData.description || ""
    );

    setImages(
      Array.isArray(initialData.images)
        ? initialData.images
        : []
    );

    setDetail(initialData.detail || "");

    /* ================= SALE ================= */

    const hasSale =
      typeof initialData.salePrice ===
        "number" &&
      initialData.salePrice >= 0.00001;

    setSaleEnabled(hasSale);

    setSalePrice(
      normalizePriceInput(
        initialData.salePrice
      )
    );

    setSaleStock(
      normalizeNumber(
        initialData.saleStock
      )
    );

    setSaleStart(
      initialData.saleStart || ""
    );

    setSaleEnd(
      initialData.saleEnd || ""
    );

    /* ================= STOCK ================= */

    setStock(
      normalizePriceInput(
        initialData.stock
      ) || 1
    );

    /* ================= STATUS ================= */

    setIsActive(
      typeof initialData.isActive ===
        "boolean"
        ? initialData.isActive
        : true
    );

    /* ================= VARIANTS ================= */

    setVariants(
      normalizeInitVariants(
        initialData.variants
      )
    );

    /* ================= SHIPPING ================= */

    const rates = Array.isArray(
      initialData.shippingRates
    )
      ? (
          initialData.shippingRates as ShippingRateItem[]
        )
      : [];

    const rateMap = new Map<
      string,
      number
    >(
      rates.map((r) => [
        r.zone,
        normalizeNumber(r.price),
      ])
    );

    setShippingRates({
      domestic:
        rateMap.get("domestic") ?? "",

      sea: rateMap.get("sea") ?? "",

      asia: rateMap.get("asia") ?? "",

      europe:
        rateMap.get("europe") ?? "",

      north_america:
        rateMap.get(
          "north_america"
        ) ?? "",

      rest_of_world:
        rateMap.get(
          "rest_of_world"
        ) ?? "",
    });

    /* ================= COUNTRY ================= */

    const domesticRate = rates.find(
      (r) => r.zone === "domestic"
    );

    setPrimaryShippingCountry(
      domesticRate
        ?.domesticCountryCode || ""
    );
  }, [initialData]);

  /* =========================================================
     AUTO RESET SALE
  ========================================================= */

  useEffect(() => {
    if (saleEnabled) {
      return;
    }

    setSalePrice("");
    setSaleStock(0);
    setSaleStart("");
    setSaleEnd("");
  }, [saleEnabled]);

  /* =========================================================
     AUTO FIX SALE STOCK
  ========================================================= */

  useEffect(() => {
    if (
      typeof stock === "number" &&
      saleStock > stock
    ) {
      setSaleStock(stock);
    }
  }, [stock, saleStock]);

  /* =========================================================
     RETURN
  ========================================================= */

  return {
    /* BASIC */
    id,
    setId,

    name,
    setName,

    price,
    setPrice,

    categoryId,
    setCategoryId,

    description,
    setDescription,

    images,
    setImages,

    detail,
    setDetail,

    /* SALE */
    saleEnabled,
    setSaleEnabled,

    salePrice,
    setSalePrice,

    saleStock,
    setSaleStock,

    saleStart,
    setSaleStart,

    saleEnd,
    setSaleEnd,

    /* STOCK */
    stock,
    setStock,

    /* STATUS */
    isActive,
    setIsActive,

    /* VARIANTS */
    variants,
    setVariants,

    /* SHIPPING */
    shippingRates,
    setShippingRates,

    primaryShippingCountry,
    setPrimaryShippingCountry,
  };
}
