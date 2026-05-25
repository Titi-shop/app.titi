"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ShoppingCart,
  ChevronDown,
  Sun,
  Moon,
} from "lucide-react";

import { useMemo, useEffect, useState } from "react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { availableLanguages } from "@/app/lib/i18n";
import { useCart } from "@/app/context/CartContext";

import { toggleDarkMode } from "@/lib/theme";

export default function Navbar() {
  const { lang, setLang } = useTranslation();
  const { cart } = useCart();

  const [dark, setDark] = useState(false);

  // SYNC THEME
  useEffect(() => {
    const sync = () => {
      setDark(document.documentElement.classList.contains("theme-dark"));
    };

    sync();
    window.addEventListener("theme-change", sync);

    return () => window.removeEventListener("theme-change", sync);
  }, []);

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const getRole = () => {
    return window.location.pathname.startsWith("/seller")
      ? "seller"
      : "customer";
  };

  // BORDER STYLE THEME
  const borderStyle = dark ? "border-black" : "border-white";

  return (
    <>
      <div className="h-[56px]" />

      <header
        className="fixed top-0 left-0 right-0 z-50 shadow-md"
        style={{
          backgroundColor: "var(--nav-bg)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="h-[56px] px-3 flex items-center justify-between">

          {/* LOGO */}
          <Link href="/" className="flex items-center gap-2">
            <div className={`relative w-8 h-8 bg-white rounded overflow-hidden border ${borderStyle}`}>
              <Image
                src="/banners/3D035BE4-0822-403D-9631-6C4CF674A519.png"
                alt="logo"
                fill
                className="object-cover"
              />
            </div>

            <span className="font-bold text-sm text-gray-200">
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
                className="bg-white text-gray-600 text-xs px-2 py-1 pr-6 rounded border"
              >
                {Object.entries(availableLanguages).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={12}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              />
            </div>

            {/* DARK MODE */}
            <button
  onClick={() => toggleDarkMode(getRole())}
  className={`w-9 h-9 flex items-center justify-center rounded border transition active:scale-95 ${borderStyle}`}
>
  {dark ? (
    <Sun size={18} color={iconColor} />
  ) : (
    <Moon size={18} color={iconColor} />
  )}
</button>
            {/* CART */}
           <Link href="/cart" className="relative">
  <div
    className={`w-9 h-9 flex items-center justify-center rounded border transition active:scale-95 ${borderStyle}`}
  >
    <ShoppingCart size={18} color={iconColor} />
  </div>

  {cartCount > 0 && (
    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
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
