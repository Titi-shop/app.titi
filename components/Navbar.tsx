"use client";

import Link from "next/link";
import Image from "next/image";

import {
  ShoppingCart,
  ChevronDown,
  Bell,
} from "lucide-react";

import { useMemo } from "react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { availableLanguages } from "@/app/lib/i18n";

import { useCart } from "@/app/context/CartContext";

export default function Navbar() {
  const { t, lang, setLang } =
    useTranslation();

  const { cart } = useCart();

  /* =========================================================
     CART COUNT
  ========================================================= */

  const cartCount = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }, [cart]);

  /* =========================================================
     UI
  ========================================================= */

  return (
    <>
      {/* SPACER */}
      <div className="h-[78px]" />

      <header
        className="
          fixed top-0 left-0 right-0 z-50
          border-b border-white/10
          bg-white/85
          backdrop-blur-2xl
        "
        style={{
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="mx-auto flex h-[64px] max-w-md items-center justify-between px-4">
          {/* =====================================================
              LEFT
          ===================================================== */}

          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <div className="relative h-11 w-11 overflow-hidden rounded-2xl bg-black">
              <Image
                src="/logo.png"
                alt="Logo"
                fill
                className="object-cover"
              />
            </div>

            <div className="leading-tight">
              <p className="text-xs font-medium text-gray-400">
                {t.marketplace || "Marketplace"}
              </p>

              <h1 className="text-lg font-black text-black">
                TITI
              </h1>
            </div>
          </Link>

          {/* =====================================================
              RIGHT
          ===================================================== */}

          <div className="flex items-center gap-2">
            {/* LANGUAGE */}

            <div className="relative">
              <select
                value={lang}
                onChange={(e) =>
                  setLang(e.target.value)
                }
                className="
                  appearance-none
                  rounded-xl
                  border border-gray-200
                  bg-white
                  py-2 pl-3 pr-8
                  text-xs font-semibold
                  text-gray-700
                  outline-none
                "
              >
                {Object.entries(
                  availableLanguages
                ).map(([code, label]) => (
                  <option
                    key={code}
                    value={code}
                  >
                    {label}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={14}
                className="
                  pointer-events-none
                  absolute right-2 top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />
            </div>

            {/* NOTIFICATION */}

            <Link
              href="/notifications"
              className="
                relative flex h-11 w-11
                items-center justify-center
                rounded-2xl
                bg-gray-100
                transition-all
                active:scale-95
              "
            >
              <Bell
                size={20}
                className="text-gray-700"
              />

              <span
                className="
                  absolute right-2 top-2
                  h-2 w-2 rounded-full
                  bg-red-500
                "
              />
            </Link>

            {/* CART */}

            <Link
              href="/cart"
              className="
                relative flex h-11 w-11
                items-center justify-center
                rounded-2xl
                bg-black
                text-white
                transition-all
                active:scale-95
              "
            >
              <ShoppingCart size={20} />

              {cartCount > 0 && (
                <span
                  className="
                    absolute -right-1 -top-1
                    flex h-5 min-w-[20px]
                    items-center justify-center
                    rounded-full
                    bg-red-500
                    px-1
                    text-[10px]
                    font-bold
                    text-white
                  "
                >
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
