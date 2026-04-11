"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";

/* ================= TYPES ================= */

type CartItem = {
  id: string;
  product_id: string;
  variant_id?: string | null;
  name: string;
  price: number;
  sale_price?: number | null;
  quantity?: number;
  thumbnail?: string;
  images?: string[];
  synced?: boolean;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  total: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

/* ================= HELPER ================= */

const buildId = (p: CartItem) =>
  p.variant_id
    ? `${p.product_id}_${p.variant_id}`
    : `${p.product_id}_default`;

const dedupeCart = (items: CartItem[]) => {
  const map = new Map<string, CartItem>();

  for (const item of items) {
    const key = `${item.product_id}_${item.variant_id ?? "null"}`;
    map.set(key, item);
  }

  return Array.from(map.values());
};

/* ================= PROVIDER ================= */

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const { user } = useAuth();

  /* ================= LOAD LOCAL ================= */

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cart");
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setCart(parsed);
    } catch {
      setCart([]);
    }
  }, []);

  /* ================= SAVE LOCAL ================= */

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  /* ================= MERGE ON LOGIN ================= */

  const mergeCartOnLogin = async () => {
    try {
      const token = await getPiAccessToken();
      if (!token || !user) return;

      const localRaw = localStorage.getItem("cart");
      const localCart: CartItem[] = localRaw ? JSON.parse(localRaw) : [];

      if (!localCart.length) {
        console.log("[CART] no local cart");
        return;
      }

      // 👉 chỉ gửi item chưa sync
      const newItems = localCart.filter((i) => !i.synced);

      if (newItems.length > 0) {
        await fetch("/api/cart", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            newItems.map((i) => ({
              product_id: i.product_id,
              variant_id: i.variant_id ?? null,
              quantity: i.quantity ?? 1,
            }))
          ),
        });
      }

      // 👉 lấy server cart
      const res = await fetch("/api/cart", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const serverCart = await res.json();

      const clean = dedupeCart(serverCart).map((item: CartItem) => ({
        ...item,
        id: buildId(item),
        quantity: item.quantity ?? 1,
        synced: true,
      }));

      setCart(clean);

      // 👉 mark local synced
      const updatedLocal = localCart.map((i) => ({
        ...i,
        synced: true,
      }));

      localStorage.setItem("cart", JSON.stringify(updatedLocal));
    } catch (err) {
      console.error("MERGE ERROR", err);
    }
  };

  useEffect(() => {
    if (!user) return;

    const key = sessionStorage.getItem("cart_merged");
    if (key === user.id) return;

    sessionStorage.setItem("cart_merged", user.id);

    console.log("[CART] MERGE");
    mergeCartOnLogin();
  }, [user]);

  /* ================= ADD ================= */

  const addToCart = async (item: CartItem) => {
    const id = buildId(item);
    const qty = item.quantity ?? 1;

    // 👉 local update
    setCart((prev) => {
      const found = prev.find((p) => p.id === id);

      if (found) {
        return prev.map((p) =>
          p.id === id
            ? { ...p, quantity: (p.quantity ?? 1) + qty, synced: false }
            : p
        );
      }

      return [
        ...prev,
        {
          ...item,
          id,
          quantity: qty,
          synced: false,
        },
      ];
    });

    if (!user) return;

    try {
      const token = await getPiAccessToken();
      if (!token) return;

      await fetch("/api/cart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: item.product_id,
          variant_id: item.variant_id ?? null,
          quantity: qty,
        }),
      });

      const res = await fetch("/api/cart", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const serverCart = await res.json();

      const clean = dedupeCart(serverCart).map((i: CartItem) => ({
        ...i,
        id: buildId(i),
        synced: true,
      }));

      setCart(clean);
    } catch (err) {
      console.error("ADD ERROR", err);
    }
  };

  /* ================= REMOVE ================= */

  const removeFromCart = async (id: string) => {
    const item = cart.find((p) => p.id === id);

    setCart((prev) => prev.filter((p) => p.id !== id));

    if (!user || !item) return;

    try {
      const token = await getPiAccessToken();
      if (!token) return;

      await fetch("/api/cart", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: item.product_id,
          variant_id: item.variant_id ?? null,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  /* ================= UPDATE ================= */

  const updateQty = async (id: string, qty: number) => {
    let target: CartItem | undefined;

    setCart((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        target = { ...p, quantity: qty };
        return target;
      })
    );

    if (!user || !target) return;

    try {
      const token = await getPiAccessToken();
      if (!token) return;

      await fetch("/api/cart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: target.product_id,
          variant_id: target.variant_id ?? null,
          quantity: target.quantity,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  /* ================= TOTAL ================= */

  const total = cart.reduce((sum, i) => {
    const price = i.sale_price ?? i.price ?? 0;
    return sum + price * (i.quantity ?? 1);
  }, 0);

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, updateQty, clearCart: () => setCart([]), total }}
    >
      {children}
    </CartContext.Provider>
  );
}

/* ================= HOOK ================= */

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
