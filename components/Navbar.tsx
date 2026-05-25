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

  // ===== SYNC THEME =====
  useEffect(() => {
    const sync = () => {
      setDark(document.documentElement.classList.contains("theme-dark"));
    };

    sync();
    window.addEventListener("theme-change", sync);

    return () => window.removeEventListener("theme-change", sync);
  }, []);

  // ===== CART COUNT =====
  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // ===== ROLE DETECT =====
  const getRole = () => {
    return window.location.pathname.startsWith("/seller")
      ? "seller"
      : "customer";
  };

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
            <div className="relative w-8 h-8 bg-white rounded overflow-hidden">
              <Image
                src="/banners/3D035BE4-0822-403D-9631-6C4CF674A519.png"
                alt="logo"
                fill
                className="object-cover"
              />
            </div>

            {/* chữ xám */}
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

            {/* DARK MODE TOGGLE */}
            <button
              onClick={() => toggleDarkMode(getRole())}
              className="w-9 h-9 flex items-center justify-center rounded transition active:scale-95"
              style={{
                backgroundColor: "var(--nav-button)",
                color: "#fff", // icon luôn trắng
              }}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* CART */}
            <Link href="/cart" className="relative">
              <div
                className="w-9 h-9 flex items-center justify-center rounded active:scale-95"
                style={{
                  backgroundColor: "var(--nav-button)",
                  color: "#fff", // icon trắng
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
