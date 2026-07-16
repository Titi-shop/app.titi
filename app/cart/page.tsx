"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/app/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import CheckoutSheet from "@/app/product/[id]/CheckoutSheet";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { formatPi } from "@/lib/pi";
import AppLoading from "@/components/AppLoading";


/* =====================================================
   PAGE
===================================================== */

export default function CartPage() {
  const { t } = useTranslation();
  const { cart, updateQty, removeFromCart } = useCart();
  const { user, pilogin } = useAuth();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [openCheckout, setOpenCheckout] = useState(false);
  const [checkoutItem, setCheckoutItem] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] =
  useState(true);
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
      item.final_price ??
      item.sale_price ??
      item.price;

    return sum + unit * item.quantity;
  }, 0);
}, [selectedItems]);

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

  const handleCheckout = async () => {
  if (!validate()) return;

  const item = selectedItems[0];
  const res = await apiAuthFetch(
  `/api/products/${item.product_id}`
);

  if (!res.ok) {
    showMessage("Cannot load product");
    return;
  }

  const product = await res.json();
  const selectedVariant =
    product.variants?.find(
      (v: { id: string }) => v.id === item.variant_id
    ) ?? null;

  setCheckoutItem({
  ...product,
  selectedVariant,

  quantity: item.quantity,

  stock:
    selectedVariant?.stock ??
    product.stock,

  price:
    selectedVariant?.price ??
    product.price,

  sale_price:
    selectedVariant?.sale_price ??
    product.sale_price,

  final_price:
    selectedVariant?.final_price ??
    product.final_price,
});

  setOpenCheckout(true);
};

  /* =====================================================
     EMPTY CART
===================================================== */
if (loading) {
  return <AppLoading />;
}
  if (cart.length === 0) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="mb-3 text-[var(--text-muted)]">
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
  <div
    className="
      fixed left-1/2 top-20 z-50
      -translate-x-1/2
      rounded-xl
      bg-green-600
      px-4 py-2
      text-sm text-white
    "
  >
    {message}
  </div>
)}

      {/* LIST */}

      <div className="bg-card">
        {cart.map((item) => {
          const unit =
       item.final_price ??
        item.sale_price ??
         item.price;

          const hasSale =
  Number.isFinite(item.final_price) &&
  item.final_price < item.price;

          return (
            <div
              key={item.id}
              className="
  flex gap-3 p-4
  border-b
  border-[var(--nav-border)]
"
            >
              {/* CHECKBOX */}

              <div className="pt-5">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(
                    item.id
                  )}
                  onChange={() =>
                    toggleItem(item.id)
                  }
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
              </div>

              {/* IMAGE */}

              <Link
  href={`/product/${item.product_id}`}
  className="relative block"
>
  <Image
    src={item.thumbnail || "/placeholder.png"}
    alt={item.name}
    width={88}
    height={88}
    className="
      h-[88px] w-[88px]
      rounded-xl
      border
      border-[var(--nav-border)]
      object-cover
    "
  />

  {hasSale && (
    <div className="absolute left-0 top-0 rounded-br-lg bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
      SALE
    </div>
  )}
</Link>

              {/* CONTENT */}

              <div className="min-w-0 flex-1">
                <Link
  href={`/product/${item.product_id}`}
  className="block"
>
  <p className="line-clamp-2 text-sm font-semibold hover:text-orange-500">
    {item.name}
  </p>
</Link>
{[
  item.option_1,
  item.option_2,
  item.option_3,
]
.filter(Boolean)
.length > 0 && (
  <p className="mt-1 text-xs text-[var(--text-muted)]">
    {[
      item.option_1,
      item.option_2,
      item.option_3,
    ]
      .filter(Boolean)
      .join(" / ")}
  </p>
)}
                {/* PRICE */}

                <div className="mt-2 flex items-center gap-2">
                  {hasSale && (
                    <span className="text-xs text-muted line-through">
                      π
                      {formatPi(item.price)}
                    </span>
                  )}

                  <span className="pi-price text-sm">
                    π
                    {formatPi(unit)}
                  </span>
                </div>

                {/* QTY */}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center overflow-hidden rounded-xl border border-[var(--nav-border)]">
                    <button
                      onClick={() =>
                        updateQty(
                          item.id,
                          item.quantity - 1
                        )
                      }
                      disabled={item.quantity <= 1}
                      className="
  bg-[var(--card-secondary)]
  px-3 py-1 text-lg
  disabled:opacity-30
"
                    >
                      −
                    </button>

                    <div className="px-4 text-sm font-semibold">
                      {item.quantity}
                    </div>

                    <button
                      onClick={() =>
                        updateQty(
                          item.id,
                          item.quantity + 1
                        )
                      }
                      className="
  px-3 py-1 text-lg
  bg-[var(--card-secondary)]
"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right">
                    <p className="pi-price text-sm">
                      π
                      {formatPi(
                        unit * item.quantity
                      )}
                    </p>
                  </div>
                </div>

                {/* DELETE */}

                <button
                  onClick={() =>
                    removeFromCart(item.id)
                  }
                  className="mt-2 text-xs text-red-500"
                >
                  {t.delete ??
                    "Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER */}

     <div className="
fixed bottom-16 left-0 right-0
border-t
bg-[var(--card-bg)]
"
style={{
  borderColor: "var(--nav-border)",
}}>  
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-muted">
            {t.total ??
              "Total"}
          </span>

          <span className="pi-price text-lg">
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
  product={checkoutItem}
          
/>
      )}

    </main>
  );
}
