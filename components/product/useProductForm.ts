"use client";

import { useState, useEffect } from "react";
import { ProductPayload, ProductVariant } from "./types";

/* =========================================================
   SHIPPING MAP
========================================================= */
function mapShippingRates(rates: any[]) {
  const base: Record<string, number | ""> = {
    domestic: "",
    sea: "",
    asia: "",
    europe: "",
    north_america: "",
    rest_of_world: "",
  };

  if (!Array.isArray(rates)) return base;

  for (const r of rates) {
    if (!r?.zone) continue;
    const price = Number(r.price);
    base[r.zone] = !Number.isNaN(price) ? price : "";
  }

  return base;
}

/* =========================================================
   HOOK
========================================================= */
export function useProductForm(initialData?: ProductPayload) {
  /* ================= BASIC ================= */
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);

  /* ================= SALE ================= */
  const [saleEnabled, setSaleEnabled] = useState(false);
  const [salePrice, setSalePrice] = useState<number | "">("");
  const [saleStock, setSaleStock] = useState<number>(0);
  const [saleStart, setSaleStart] = useState("");
  const [saleEnd, setSaleEnd] = useState("");

  /* ================= STOCK ================= */
  const [stock, setStock] = useState<number | "">(1);

  /* ================= STATUS ================= */
  const [isActive, setIsActive] = useState(true);

  /* ================= DETAIL ================= */
  const [detail, setDetail] = useState("");

  /* ================= VARIANTS ================= */
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  /* ================= SHIPPING ================= */
  const [shippingRates, setShippingRates] = useState<
    Record<string, number | "">
  >({
    domestic: "",
    sea: "",
    asia: "",
    europe: "",
    north_america: "",
    rest_of_world: "",
  });

  /* =========================================================
     INIT DATA (EDIT MODE)
  ========================================================= */
  useEffect(() => {
    if (!initialData) return;

    console.log("📦 INIT PRODUCT:", initialData);

    /* ================= BASIC ================= */
    setName(initialData.name || "");
    setPrice(initialData.price ?? "");
    setCategoryId(initialData.categoryId || "");
    setDescription(initialData.description || "");
    setImages(initialData.images || []);

    /* ================= SALE ================= */
    const hasSale =
      typeof initialData.salePrice === "number" &&
      initialData.salePrice > 0;

    setSaleEnabled(hasSale);
    setSalePrice(initialData.salePrice ?? "");
    setSaleStock((initialData as any).saleStock ?? 0);
    setSaleStart(initialData.saleStart ?? "");
    setSaleEnd(initialData.saleEnd ?? "");

    /* ================= STOCK ================= */
    setStock(initialData.stock ?? 1);

    /* ================= STATUS ================= */
    setIsActive(
      typeof initialData.isActive === "boolean"
        ? initialData.isActive
        : true
    );

    /* ================= DETAIL ================= */
    setDetail(initialData.detail || "");

    /* ================= VARIANTS ================= */
    setVariants(initialData.variants || []);

    /* ================= SHIPPING ================= */
    setShippingRates(
      mapShippingRates(initialData.shippingRates || [])
    );

  }, [initialData]);

  /* =========================================================
     AUTO FIX: SALE LOGIC
  ========================================================= */

  /* ❌ disable sale → reset */
  useEffect(() => {
    if (!saleEnabled) {
      setSalePrice("");
      setSaleStock(0);
    }
  }, [saleEnabled]);

  /* 🔥 ensure saleStock <= stock */
  useEffect(() => {
    if (typeof stock === "number" && saleStock > stock) {
      setSaleStock(stock);
    }
  }, [stock, saleStock]);

  /* 🔥 nếu có variant → tắt sale product */
  useEffect(() => {
    if (variants.length > 0 && saleEnabled) {
      console.warn("⚠️ Disable product sale because variants exist");
      setSaleEnabled(false);
    }
  }, [variants]);

  /* =========================================================
     RETURN
  ========================================================= */
  return {
    /* BASIC */
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

    /* DETAIL */
    detail,
    setDetail,

    /* VARIANTS */
    variants,
    setVariants,

    /* SHIPPING */
    shippingRates,
    setShippingRates,
  };
}
