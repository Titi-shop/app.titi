"use client";

import { useEffect, useState } from "react";
import type { ProductVariant } from "./types";

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
  price: number | string;
  domestic_country_code?: string | null;
};

/* =========================================================
   DEFAULT
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

const toNumber = (v: any, fallback = 0): number => {
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
};

const toInputNumber = (v: any): number | "" => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isNaN(n) ? "" : n;
};

/* FIX: datetime-local safe (no crash, no invalid date) */
const toDateInput = (v: any): string => {
  if (!v) return "";

  const d = new Date(v);
  if (isNaN(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
};

/* =========================================================
   VARIANTS NORMALIZE
========================================================= */

function normalizeVariants(input?: ProductVariant[]): ProductVariant[] {
  if (!Array.isArray(input)) return [];

  return input.map((v, index) => {
    const price = toNumber(v.price);
    const salePrice = v.sale_price != null ? toNumber(v.sale_price) : null;
    const saleEnabled = Boolean(v.sale_enabled);

    const finalPrice =
      saleEnabled && salePrice !== null && salePrice < price
        ? salePrice
        : price;

    return {
      ...v,

      price,
      sale_price:
        saleEnabled && salePrice !== null && salePrice < price
          ? salePrice
          : null,

      final_price: finalPrice,

      sale_enabled: saleEnabled,

      stock: toNumber(v.stock),
      sale_stock: toNumber(v.sale_stock),
      sale_sold: toNumber(v.sale_sold),

      is_active: v.is_active !== false,
      is_unlimited: Boolean(v.is_unlimited),

      sort_order: toNumber(v.sort_order, index),
    };
  });
}

/* =========================================================
   HOOK
========================================================= */

export function useProductForm(initialData?: any) {
  /* ================= BASIC ================= */

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [detail, setDetail] = useState("");

  /* ================= SALE ================= */

  const [saleEnabled, setSaleEnabled] = useState(false);
  const [salePrice, setSalePrice] = useState<number | "">("");
  const [saleStock, setSaleStock] = useState(0);
  const [saleStart, setSaleStart] = useState("");
  const [saleEnd, setSaleEnd] = useState("");

  /* ================= STOCK ================= */

  const [stock, setStock] = useState<number | "">(1);

  /* ================= STATUS ================= */

  const [isActive, setIsActive] = useState(true);

  /* ================= VARIANTS ================= */

  const [variants, setVariants] = useState<ProductVariant[]>([]);

  /* ================= SHIPPING ================= */

  const [shippingRates, setShippingRates] =
    useState<ShippingRatesState>(DEFAULT_SHIPPING);

  const [primaryShippingCountry, setPrimaryShippingCountry] = useState("");

  /* =========================================================
     INIT (FIXED + SAFE MAPPING)
  ========================================================= */

  useEffect(() => {
    if (!initialData) return;

    setId(initialData.id || "");
    setName(initialData.name || "");

    setPrice(toInputNumber(initialData.price));

    /* FIX: avoid "null" string bug */
    setCategoryId(initialData.category_id ?? "");

    setDescription(initialData.description || "");
    setImages(Array.isArray(initialData.images) ? initialData.images : []);
    setDetail(initialData.detail || "");

    /* ================= SALE FIX ================= */

   const rawSaleEnabled = Boolean(initialData.sale_enabled);

    setSaleEnabled(rawSaleEnabled);

    setSalePrice(toInputNumber(initialData.sale_price));

    setSaleStock(toNumber(initialData.sale_stock));

    setSaleStart(toDateInput(initialData.sale_start));
    setSaleEnd(toDateInput(initialData.sale_end));

    /* ================= STOCK ================= */

    setStock(toInputNumber(initialData.stock) || 1);

    /* ================= STATUS ================= */

    setIsActive(Boolean(initialData.is_active));

    /* ================= VARIANTS ================= */

    setVariants(normalizeVariants(initialData.variants));

    /* ================= SHIPPING ================= */

    const rates = Array.isArray(initialData.shippingRates)
      ? (initialData.shippingRates as ShippingRateItem[])
      : [];

    const map = new Map<string, number>();

    rates.forEach((r) => {
      map.set(r.zone, toNumber(r.price));
    });

    setShippingRates({
      domestic: map.get("domestic") ?? "",
      sea: map.get("sea") ?? "",
      asia: map.get("asia") ?? "",
      europe: map.get("europe") ?? "",
      north_america: map.get("north_america") ?? "",
      rest_of_world: map.get("rest_of_world") ?? "",
    });

    const domestic = rates.find((r) => r.zone === "domestic");
    setPrimaryShippingCountry(domestic?.domestic_country_code || "");
  }, [initialData]);

  /* =========================================================
     AUTO RESET SALE
  ========================================================= */

  useEffect(() => {
    if (saleEnabled) return;

    setSalePrice("");
    setSaleStock(0);
    setSaleStart("");
    setSaleEnd("");
  }, [saleEnabled]);

  /* =========================================================
     AUTO FIX SALE STOCK
  ========================================================= */

  useEffect(() => {
    if (typeof stock === "number" && saleStock > stock) {
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
