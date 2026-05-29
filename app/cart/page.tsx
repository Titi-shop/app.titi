"use client";

import { useEffect, useMemo, useState } from "react";

import Image from "next/image";

import Link from "next/link";

import { useCart } from "@/app/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import CheckoutSheet from "@/app/product/[id]/CheckoutSheet";

import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";

/* =====================================================
   TYPES
===================================================== */

interface ShippingInfo {
  name: string;
  phone: string;
  address_line: string;
  country?: string;
  postal_code?: string | null;
}

/* =====================================================
   PAGE
===================================================== */

export default function CartPage() {
  const { t } = useTranslation();

  const { cart, updateQty, removeFromCart } = useCart();

  const { user, pilogin } = useAuth();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [shipping, setShipping] = useState<ShippingInfo | null>(null);

  const [openCheckout, setOpenCheckout] = useState(false);

  const [checkoutItem, setCheckoutItem] = useState<any>(null);

  const [message, setMessage] = useState<string | null>(null);

  /* =====================================================
     MESSAGE
  ===================================================== */

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  /* =====================================================
     SELECTED ITEMS
  ===================================================== */

  const selectedItems = useMemo(() => {
    return cart.filter((i) => selectedIds.includes(i.id));
  }, [cart, selectedIds]);

  /* =====================================================
     TOTAL
  ===================================================== */

  const total = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      const unit =
        typeof item.sale_price === "number"
          ? item.sale_price
          : item.price;

      return sum + unit * item.quantity;
    }, 0);
  }, [selectedItems]);

  /* =====================================================
     LOAD SHIPPING
  ===================================================== */

  useEffect(() => {
    async function load() {
      if (!user) return;

      try {
        const token = await getPiAccessToken();

        const res = await fetch("/api/address", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) return;

        const data = await res.json();

        const def = data.items?.find(
          (a: any) => a.is_default
        );

        if (!def) return;

        setShipping({
          name: def.full_name,
          phone: def.phone,
          address_line: def.address_line,
          country: def.country,
          postal_code: def.postal_code ?? null,
        });
      } catch (err) {
        console.error("[CART][ADDRESS_ERROR]", err);
      }
    }

    load();
  }, [user]);

  /* =====================================================
     TOGGLE ITEM
  ===================================================== */

  const toggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  /* =====================================================
     CHECKOUT VALIDATION (LIGHT ONLY)
  ===================================================== */

  const validate = () => {
    if (!user) {
      pilogin?.();
      showMessage(t.please_login ?? "Please login");
      return false;
    }

    if (!shipping) {
      showMessage(
        t.please_add_shipping_address ??
          "Add shipping address"
      );
      return false;
    }

    if (selectedItems.length !== 1) {
      showMessage(
        t.only_one_product_supported ??
          "Select 1 product"
      );
      return false;
    }

    return true;
  };

  /* =====================================================
     CHECKOUT ACTION
===================================================== */

  const handleCheckout = () => {
    if (!validate()) return;

    const item = selectedItems[0];

    setCheckoutItem({
      id: item.product_id ?? item.id,
      name: item.name,
      price: item.price,
      sale_price: item.sale_price,
      final_price: item.final_price,
      thumbnail: item.thumbnail,
      quantity: item.quantity,
      variant_id: item.variant?.id ?? null,
    });

    setOpenCheckout(true);
  };

  /* =====================================================
     EMPTY CART
===================================================== */

  if (cart.length === 0) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-3">
            {t.empty_cart ?? "Cart is empty"}
          </p>

          <Link href="/" className="text-orange-500 font-semibold">
            {t.back_to_shop ?? "Back to shop"}
          </Link>
        </div>
      </main>
    );
  }

  /* =====================================================
     UI
===================================================== */

  return (
    <main className="min-h-screen bg-[var(--background)] pb-40">

      {/* MESSAGE */}
      {message && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-lg text-sm z-50">
          {message}
        </div>
      )}

      {/* CART LIST */}
      <div className="bg-card divide-y">

        {cart.map((item) => {
          const unit =
            typeof item.sale_price === "number"
              ? item.sale_price
              : item.price;

          return (
            <div
              key={item.id}
              className="flex gap-3 p-4"
            >
              {/* CHECKBOX */}
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => toggleItem(item.id)}
              />

              {/* IMAGE */}
              <Image
                src={item.thumbnail || "/placeholder.png"}
                alt={item.name}
                width={80}
                height={80}
                className="rounded-lg object-cover"
              />

              {/* INFO */}
              <div className="flex-1">
                <p className="text-sm font-semibold">
                  {item.name}
                </p>

                <p className="text-orange-500 font-bold mt-1">
                  π{formatPi(unit)}
                </p>

                {/* QTY */}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() =>
                      updateQty(item.id, item.quantity - 1)
                    }
                  >
                    -
                  </button>

                  <span>{item.quantity}</span>

                  <button
                    onClick={() =>
                      updateQty(item.id, item.quantity + 1)
                    }
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-xs text-red-500 mt-2"
                >
                  {t.delete ?? "Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4">

        <div className="flex justify-between mb-3">
          <span>{t.total ?? "Total"}</span>
          <span className="font-bold text-orange-500">
            π{formatPi(total)}
          </span>
        </div>

        <button
          onClick={handleCheckout}
          className="w-full bg-primary text-white py-3 rounded-xl font-bold"
        >
          {t.pay_now ?? "Checkout"}
        </button>

      </div>

      {/* CHECKOUT SHEET */}
      {checkoutItem && (
        <CheckoutSheet
          open={openCheckout}
          onClose={() => setOpenCheckout(false)}
          product={{
            id: checkoutItem.id,
            selectedVariant: null,
            name: checkoutItem.name,
            price: checkoutItem.price,
            salePrice: checkoutItem.sale_price,
            finalPrice: checkoutItem.final_price,
            thumbnail: checkoutItem.thumbnail,
            stock: 9999,
            shipping_rates: null,
            variant_id: checkoutItem.variant_id,
          }}
        />
      )}

    </main>
  );
}
