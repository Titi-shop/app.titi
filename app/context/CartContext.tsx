"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

/* =========================
   TYPES
========================= */

type CartItem = {
  id: string;
  product_id?: string;

  name: string;

  price: number;
  sale_price?: number | null;

  stock?: number;

  variant?: {
    optionValue?: string;
    stock?: number;
  };

  description?: string;
  thumbnail?: string;
  image?: string;
  images?: string[];

  quantity?: number;
};

type CartContextType = {
  cart: CartItem[];

  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;

  updateQty: (id: string, qty: number) => void;
  updateItem: (id: string, data: Partial<CartItem>) => void;

  total: number;
};

/* ========================= */

const CartContext = createContext<CartContextType | undefined>(undefined);

/* ========================= */

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  /* =========================
     LOAD LOCAL STORAGE
  ========================= */

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cart");

      if (!raw) {
        setCart([]);
        return;
      }

      const parsed: unknown = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        setCart([]);
        return;
      }

      setCart(parsed as CartItem[]);
    } catch {
      setCart([]);
    }
  }, []);

  /* =========================
     SAVE LOCAL STORAGE
  ========================= */

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  /* =========================
     ADD TO CART (CHECK STOCK)
  ========================= */

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const found = prev.find((p) => p.id === item.id);

      const maxStock =
        item.variant?.stock ?? item.stock ?? 99;

      if (found) {
        const newQty =
          (found.quantity ?? 1) + (item.quantity ?? 1);

        return prev.map((p) =>
          p.id === item.id
            ? {
                ...p,
                quantity: Math.min(maxStock, newQty),
              }
            : p
        );
      }

      return [
        ...prev,
        {
          ...item,
          product_id: item.product_id ?? item.id,

          quantity: Math.min(maxStock, item.quantity ?? 1),

          thumbnail:
            item.thumbnail ||
            item.image ||
            item.images?.[0] ||
            "",

          image:
            item.image ||
            item.thumbnail ||
            item.images?.[0] ||
            "",

          images: item.images || [],
        },
      ];
    });
  };

  /* =========================
     REMOVE
  ========================= */

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  /* =========================
     CLEAR
  ========================= */

  const clearCart = () => setCart([]);

  /* =========================
     UPDATE QUANTITY (CLAMP STOCK)
  ========================= */

  const updateQty = (id: string, qty: number) => {
    setCart((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;

        const maxStock =
          p.variant?.stock ?? p.stock ?? 99;

        const safeQty = Math.max(
          1,
          Math.min(maxStock, qty || 1)
        );

        return {
          ...p,
          quantity: safeQty,
        };
      })
    );
  };

  /* =========================
     UPDATE ITEM (SYNC PRICE / DATA)
  ========================= */

  const updateItem = (id: string, data: Partial<CartItem>) => {
    setCart((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...data } : p
      )
    );
  };

  /* =========================
     TOTAL
  ========================= */

  const total = cart.reduce((sum, item) => {
    const unit =
      typeof item.sale_price === "number"
        ? item.sale_price
        : Number(item.price) || 0;

    return sum + unit * (item.quantity ?? 1);
  }, 0);

  /* ========================= */

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        updateQty,
        updateItem,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

/* ========================= */

export function useCart() {
  const ctx = useContext(CartContext);

  if (!ctx) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return ctx;
}
