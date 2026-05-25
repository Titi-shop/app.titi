"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, ChevronDown, Bell, Sun, Moon } from "lucide-react";
import { useMemo, useEffect, useState } from "react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { availableLanguages } from "@/app/lib/i18n";
import { useCart } from "@/app/context/CartContext";

export default function Navbar() {
  const { t, lang, setLang } = useTranslation();
  const { cart } = useCart();

  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme-mode");
    if (saved === "dark") {
      document.documentElement.classList.add("theme-dark");
      setDark(true);
    }
  }, []);

  const toggleDark = () => {
    const root = document.documentElement;

    const isDark = root.classList.contains("theme-dark");

    root.classList.toggle("theme-dark", !isDark);
    root.classList.toggle("theme-light", isDark);

    localStorage.setItem("theme-mode", isDark ? "light" : "dark");
    setDark(!isDark);
  };

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  return (
    <>
      <div className="h-[56px]" />

      <header
    className="
    fixed top-0 left-0 right-0 z-50
     shadow-md
    "
  style={{
    backgroundColor: "var(--nav-bg)",
    color: "var(--nav-text)",
    paddingTop: "env(safe-area-inset-top)",
  }}
  >
        <div className="h-[56px] px-3 flex items-center justify-between">

          {/* LOGO */}
          <Link href="/" className="flex items-center gap-2">
            <div className="relative w-8 h-8 bg-white rounded overflow-hidden">
              <Image
                src="/banners/3D035BE4-0822-403D-9631-6C4CF674A519.png"
                alt="logo"
                fill
                className="object-cover"
              />
            </div>
           <span className="font-bold text-sm"> TITI</span>
          </Link>

          {/* RIGHT */}
          <div className="flex items-center gap-2">

            {/* LANGUAGE */}
            <div className="relative">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
               className="  bg-white text-black text-xs  px-2 py-1 pr-6 rounded  border"
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

             {/* DARK MODE TOGGLE */}
            <button
    onClick={toggleDark}
  className="
    w-9 h-9 flex items-center justify-center rounded
    transition active:scale-95
  "
  style={{
    backgroundColor: "var(--nav-button)",
    color: dark ? "#fff" : "#000",
  }}
  >
    {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>

            {/* CART (FIXED) */}
           <Link href="/cart" className="relative">
  <div
    className="w-9 h-9 flex items-center justify-center rounded active:scale-95"
    style={{
      backgroundColor: "var(--nav-button)",
      color: "var(--nav-primary)",
    }}
  >
    <ShoppingCart size={18} />
  </div>

  {cartCount > 0 && (
    <span className="
      absolute -top-1 -right-1
      bg-red-600 text-white
      text-[10px] px-1.5 py-0.5
      rounded-full
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
