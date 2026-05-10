"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

import { useAuth } from "@/context/AuthContext";

import { getPiAccessToken } from "@/lib/piAuth";

/* =========================================================
   TYPES
========================================================= */

export type CartItem = {
  id: string;

  product_id: string;
  variant_id: string | null;

  name: string;
  slug: string;

  price: string;
  sale_price: string;

  quantity: number;

  thumbnail: string;
  images: string[];

  is_price_changed: boolean;
  is_out_of_stock: boolean;

  synced: boolean;
};

type CartContextType = {
  cart: CartItem[];

  total: number;

  addToCart: (
    item: {
      product_id: string;
      variant_id?: string | null;
      quantity?: number;
    }
  ) => Promise<void>;

  removeFromCart: (
    id: string
  ) => Promise<void>;

  updateQty: (
    id: string,
    quantity: number
  ) => Promise<void>;

  clearCart: () => Promise<void>;

  refreshCart: () => Promise<void>;
};

/* =========================================================
   CONTEXT
========================================================= */

const CartContext =
  createContext<CartContextType | null>(
    null
  );

/* =========================================================
   HELPERS
========================================================= */

function buildCartId(
  productId: string,
  variantId: string | null
): string {
  return `${productId}_${
    variantId ?? "default"
  }`;
}

function safeNumber(
  value: unknown
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function normalizeQuantity(
  value: unknown
): number {
  const quantity =
    typeof value === "number" &&
    Number.isFinite(value)
      ? Math.floor(value)
      : 1;

  if (quantity <= 0) {
    return 1;
  }

  if (quantity > 99) {
    return 99;
  }

  return quantity;
}

function normalizeServerCart(
  rows: unknown
): CartItem[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter(
      (
        row
      ): row is Record<
        string,
        unknown
      > =>
        typeof row === "object" &&
        row !== null
    )
    .map((row) => {
      const productId =
        typeof row.product_id ===
        "string"
          ? row.product_id
          : "";

      const variantId =
        typeof row.variant_id ===
        "string"
          ? row.variant_id
          : null;

      return {
        id: buildCartId(
          productId,
          variantId
        ),

        product_id: productId,

        variant_id: variantId,

        name:
          typeof row.name === "string"
            ? row.name
            : "",

        slug:
          typeof row.slug === "string"
            ? row.slug
            : "",

        price:
          typeof row.price === "string"
            ? row.price
            : "0",

        sale_price:
          typeof row.sale_price ===
          "string"
            ? row.sale_price
            : "0",

        quantity: normalizeQuantity(
          row.quantity
        ),

        thumbnail:
          typeof row.thumbnail ===
          "string"
            ? row.thumbnail
            : "",

        images: Array.isArray(
          row.images
        )
          ? row.images.filter(
              (
                image
              ): image is string =>
                typeof image ===
                "string"
            )
          : [],

        is_price_changed:
          row.is_price_changed ===
          true,

        is_out_of_stock:
          row.is_out_of_stock ===
          true,

        synced: true,
      };
    });
}

function loadLocalCart(): CartItem[] {
  try {
    const raw =
      localStorage.getItem("cart");

    if (!raw) {
      return [];
    }

    const parsed: unknown =
      JSON.parse(raw);

    return normalizeServerCart(parsed);
  } catch {
    return [];
  }
}

function saveLocalCart(
  cart: CartItem[]
): void {
  localStorage.setItem(
    "cart",
    JSON.stringify(cart)
  );
}

/* =========================================================
   PROVIDER
========================================================= */

export function CartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  const [cart, setCart] = useState<
    CartItem[]
  >([]);

  /* =========================================================
     LOAD LOCAL
  ========================================================= */

  useEffect(() => {
    const local =
      loadLocalCart();

    setCart(local);
  }, []);

  /* =========================================================
     SAVE LOCAL
  ========================================================= */

  useEffect(() => {
    saveLocalCart(cart);
  }, [cart]);

  /* =========================================================
     FETCH SERVER CART
  ========================================================= */

  const fetchServerCart =
    useCallback(async (): Promise<
      CartItem[]
    > => {
      const token =
        await getPiAccessToken();

      if (!token) {
        return [];
      }

      const res = await fetch(
        "/api/cart",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error(
          "FETCH_CART_FAILED"
        );
      }

      const data: unknown =
        await res.json();

      return normalizeServerCart(
        data
      );
    }, []);

  /* =========================================================
     REFRESH CART
  ========================================================= */

  const refreshCart =
    useCallback(async () => {
      if (!user) {
        return;
      }

      try {
        const serverCart =
          await fetchServerCart();

        setCart(serverCart);
      } catch (err) {
        console.error(
          "[CART][REFRESH]",
          err
        );
      }
    }, [fetchServerCart, user]);

  /* =========================================================
     MERGE ON LOGIN
  ========================================================= */

  useEffect(() => {
    if (!user) {
      return;
    }

    const merge = async () => {
      try {
        const token =
          await getPiAccessToken();

        if (!token) {
          return;
        }

        const localCart =
          loadLocalCart();

        if (
          localCart.length > 0
        ) {
          await fetch(
            "/api/cart",
            {
              method: "POST",

              headers: {
                Authorization: `Bearer ${token}`,

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                localCart.map(
                  (item) => ({
                    product_id:
                      item.product_id,

                    variant_id:
                      item.variant_id,

                    quantity:
                      item.quantity,
                  })
                )
              ),
            }
          );
        }

        const serverCart =
          await fetchServerCart();

        setCart(serverCart);

        console.log(
          "[CART][MERGE_OK]",
          {
            items:
              serverCart.length,
          }
        );
      } catch (err) {
        console.error(
          "[CART][MERGE_FAILED]",
          err
        );
      }
    };

    merge();
  }, [user, fetchServerCart]);

  /* =========================================================
     ADD TO CART
  ========================================================= */

  const addToCart =
    useCallback(
      async (item: {
        product_id: string;
        variant_id?: string | null;
        quantity?: number;
      }) => {
        try {
          const token =
            await getPiAccessToken();

          const payload = {
            product_id:
              item.product_id,

            variant_id:
              item.variant_id ??
              null,

            quantity:
              normalizeQuantity(
                item.quantity
              ),
          };

          /* ================= LOCAL ONLY ================= */

          if (!user || !token) {
            const local =
              loadLocalCart();

            const id =
              buildCartId(
                payload.product_id,
                payload.variant_id
              );

            const existed =
              local.find(
                (i) =>
                  i.id === id
              );

            if (existed) {
              existed.quantity +=
                payload.quantity;

              if (
                existed.quantity >
                99
              ) {
                existed.quantity = 99;
              }
            } else {
              local.push({
                id,

                product_id:
                  payload.product_id,

                variant_id:
                  payload.variant_id,

                name: "",
                slug: "",

                price: "0",
                sale_price: "0",

                quantity:
                  payload.quantity,

                thumbnail: "",

                images: [],

                is_price_changed:
                  false,

                is_out_of_stock:
                  false,

                synced: false,
              });
            }

            setCart([...local]);

            return;
          }

          /* ================= SERVER ================= */

          const res = await fetch(
            "/api/cart",
            {
              method: "POST",

              headers: {
                Authorization: `Bearer ${token}`,

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                payload
              ),
            }
          );

          if (!res.ok) {
            throw new Error(
              "ADD_CART_FAILED"
            );
          }

          const data: unknown =
            await res.json();

          const normalized =
            normalizeServerCart(
              data
            );

          setCart(normalized);

          console.log(
            "[CART][ADD_OK]",
            {
              product:
                payload.product_id,
            }
          );
        } catch (err) {
          console.error(
            "[CART][ADD_FAILED]",
            err
          );
        }
      },
      [user]
    );

  /* =========================================================
     REMOVE
  ========================================================= */

  const removeFromCart =
    useCallback(
      async (id: string) => {
        try {
          const target =
            cart.find(
              (item) =>
                item.id === id
            );

          if (!target) {
            return;
          }

          /* ================= LOCAL ONLY ================= */

          if (!user) {
            const next =
              cart.filter(
                (item) =>
                  item.id !== id
              );

            setCart(next);

            return;
          }

          const token =
            await getPiAccessToken();

          if (!token) {
            return;
          }

          const res = await fetch(
            "/api/cart",
            {
              method: "DELETE",

              headers: {
                Authorization: `Bearer ${token}`,

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                {
                  product_id:
                    target.product_id,

                  variant_id:
                    target.variant_id,
                }
              ),
            }
          );

          if (!res.ok) {
            throw new Error(
              "DELETE_CART_FAILED"
            );
          }

          const data: unknown =
            await res.json();

          const normalized =
            normalizeServerCart(
              data
            );

          setCart(normalized);

          console.log(
            "[CART][DELETE_OK]",
            {
              id,
            }
          );
        } catch (err) {
          console.error(
            "[CART][DELETE_FAILED]",
            err
          );
        }
      },
      [cart, user]
    );

  /* =========================================================
     UPDATE QTY
  ========================================================= */

  const updateQty =
    useCallback(
      async (
        id: string,
        quantity: number
      ) => {
        try {
          const target =
            cart.find(
              (item) =>
                item.id === id
            );

          if (!target) {
            return;
          }

          const normalizedQuantity =
            normalizeQuantity(
              quantity
            );

          /* ================= LOCAL ONLY ================= */

          if (!user) {
            const next =
              cart.map((item) => {
                if (
                  item.id !== id
                ) {
                  return item;
                }

                return {
                  ...item,
                  quantity:
                    normalizedQuantity,
                };
              });

            setCart(next);

            return;
          }

          const token =
            await getPiAccessToken();

          if (!token) {
            return;
          }

          const res = await fetch(
            "/api/cart",
            {
              method: "PATCH",

              headers: {
                Authorization: `Bearer ${token}`,

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                {
                  product_id:
                    target.product_id,

                  variant_id:
                    target.variant_id,

                  quantity:
                    normalizedQuantity,
                }
              ),
            }
          );

          if (!res.ok) {
            throw new Error(
              "UPDATE_QTY_FAILED"
            );
          }

          const data: unknown =
            await res.json();

          const normalized =
            normalizeServerCart(
              data
            );

          setCart(normalized);

          console.log(
            "[CART][QTY_OK]",
            {
              id,
              quantity:
                normalizedQuantity,
            }
          );
        } catch (err) {
          console.error(
            "[CART][QTY_FAILED]",
            err
          );
        }
      },
      [cart, user]
    );

  /* =========================================================
     CLEAR CART
  ========================================================= */

  const clearCart =
    useCallback(async () => {
      setCart([]);

      localStorage.removeItem(
        "cart"
      );
    }, []);

  /* =========================================================
     TOTAL
  ========================================================= */

  const total = useMemo(() => {
    return cart.reduce(
      (sum, item) => {
        const raw =
          item.sale_price ||
          item.price ||
          "0";

        const price =
          safeNumber(raw);

        return (
          sum +
          price * item.quantity
        );
      },
      0
    );
  }, [cart]);

  /* =========================================================
     CONTEXT
  ========================================================= */

  return (
    <CartContext.Provider
      value={{
        cart,

        total,

        addToCart,

        removeFromCart,

        updateQty,

        clearCart,

        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

/* =========================================================
   HOOK
========================================================= */

export function useCart() {
  const ctx =
    useContext(CartContext);

  if (!ctx) {
    throw new Error(
      "useCart must be used inside CartProvider"
    );
  }

  return ctx;
}
