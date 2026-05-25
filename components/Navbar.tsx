"use client";

import Link from "next/link";
import Image from "next/image";

import { ShoppingCart, ChevronDown, Bell } from "lucide-react";
import { useMemo } from "react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { availableLanguages } from "@/app/lib/i18n";
import { useCart } from "@/app/context/CartContext";

export default function Navbar() {
  const { t, lang, setLang } = useTranslation();
  const { cart } = useCart();

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  return (
    <>
      {/* spacer đúng height navbar */}
      <div className="h-[56px]" />

      <header
        className="
          fixed top-0 left-0 right-0 z-50
          bg-orange-500 text-white
          shadow-md
        "
        style={{
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="h-[56px] px-3 flex items-center justify-between">
          
          {/* LEFT - LOGO */}
          <Link href="/" className="flex items-center gap-2">
            <div className="relative w-8 h-8 rounded-md overflow-hidden bg-white">
              <Image
                src="/banners/3D035BE4-0822-403D-9631-6C4CF674A519.png"
                alt="Logo"
                fill
                className="object-cover"
              />
            </div>

            <span className="font-bold text-sm">
              TITI
            </span>
          </Link>

          {/* RIGHT */}
          <div className="flex items-center gap-2">

            {/* LANGUAGE */}
            <div className="relative">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="
                  bg-white text-black text-xs
                  px-2 py-1 pr-6 rounded
                  appearance-none
                "
              >
                {Object.entries(availableLanguages).map(
                  ([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  )
                )}
              </select>

              <ChevronDown
                size={12}
                className="
                  absolute right-1 top-1/2
                  -translate-y-1/2 text-gray-500
                  pointer-events-none
                "
              />
            </div>

            {/* NOTI */}
            <Link
              href="/notifications"
              className="relative"
            >
              <div className="w-9 h-9 flex items-center justify-center rounded bg-orange-600 active:scale-95">
                <Bell size={18} />
              </div>

              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Link>

            {/* CART */}
            <Link href="/cart" className="relative">
              <div className="w-9 h-9 flex items-center justify-center rounded bg-white text-orange-500 active:scale-95">
                <ShoppingCart size={18} />
              </div>

              {cartCount > 0 && (
                <span className="
                  absolute -top-1 -right-1
                  bg-red-600 text-white
                  text-[10px] px-1.5 py-0.5
                  rounded-full min-w-[16px]
                  text-center
                ">
                  {cartCount}
                </span>
              )}
            </Link>

          </div>
        </div>
      </header>
    </>
  );
}
