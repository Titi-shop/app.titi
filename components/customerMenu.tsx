"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  User,
  Package,
  Wallet,
  HelpCircle,
  MessageCircle,
  Globe,
  MapPin,
  Store,
  ChevronRight,
} from "lucide-react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";

/* =========================================================
   TYPES
========================================================= */

type MenuItem = {
  label: string;
  icon: React.ReactNode;
  path?: string;
  onClick?: () => void | Promise<void>;
};

/* =========================================================
   COMPONENT
========================================================= */

export default function CustomerMenu() {
  const router = useRouter();

  const { t } = useTranslation();

  const { user, pilogin } = useAuth();

  const [sellerLoading, setSellerLoading] =
    useState(false);

  const [sellerMessage, setSellerMessage] =
    useState<string | null>(null);

  /* =========================================================
     ROLE
  ========================================================= */

  const isSeller =
    user?.role === "seller" ||
    user?.role === "admin";

  /* =========================================================
     SELLER ACTION
  ========================================================= */

  async function handleSellerClick() {
    if (sellerLoading) return;

    if (!user) {
      await pilogin();
      return;
    }

    if (isSeller) {
      router.push("/seller");
      return;
    }

    try {
      setSellerLoading(true);

      setSellerMessage(null);

      const token =
        await getPiAccessToken();

      if (!token) {
        setSellerMessage(
          `⚠️ ${
            t.session_expired ??
            "Session expired"
          }`
        );

        await pilogin();

        return;
      }

      const res = await fetch(
        "/api/seller/register",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data: unknown =
        await res
          .json()
          .catch(() => null);

      if (!res.ok) {
        const err =
          typeof data === "object" &&
          data !== null &&
          "error" in data
            ? String(
                (
                  data as {
                    error: string;
                  }
                ).error
              )
            : t.register_failed ??
              "Register failed";

        setSellerMessage(
          `❌ ${err}`
        );

        return;
      }

      setSellerMessage(
        `✅ ${
          t.seller_request_sent ??
          "Seller request sent"
        }`
      );
    } catch (err) {
      console.error(
        "SELLER REGISTER ERROR:",
        err
      );

      setSellerMessage(
        `❌ ${
          t.system_error ??
          "System error"
        }`
      );
    } finally {
      setSellerLoading(false);
    }
  }

  /* =========================================================
     MENU ITEMS
  ========================================================= */

  const items: MenuItem[] =
    useMemo(
      () => [
        {
          label:
            t.profile ??
            "Profile",

          icon: (
            <User size={21} />
          ),

          path:
            "/customer/profile",
        },

        {
          label:
            t.my_orders ??
            "Orders",

          icon: (
            <Package size={21} />
          ),

          path:
            "/customer/orders",
        },

        {
          label:
            t.pi_wallet ??
            "Wallet",

          icon: (
            <Wallet size={21} />
          ),

          path:
            "/account/wallet",
        },

        {
          label:
            t.messages ??
            "Messages",

          icon: (
            <MessageCircle
              size={21}
            />
          ),
        },

        {
          label:
            t.language ??
            "Language",

          icon: (
            <Globe size={21} />
          ),
        },

        {
          label:
            t.shipping_address ??
            "Address",

          icon: (
            <MapPin size={21} />
          ),

          path:
            "/customer/address",
        },

        {
          label:
            t.support ??
            "Support",

          icon: (
            <HelpCircle
              size={21}
            />
          ),
        },

        {
          label: isSeller
            ? t.seller_center ??
              "Seller Center"
            : t.register_seller ??
              "Become Seller",

          icon: (
            <Store size={21} />
          ),

          onClick:
            handleSellerClick,
        },
      ],
      [t, isSeller]
    );

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <section
      className="
        mx-4 mt-4 overflow-hidden rounded-3xl
        border border-gray-200
        bg-white
        shadow-sm

        dark:border-zinc-800
        dark:bg-zinc-950
      "
    >
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div
        className="
          flex items-center justify-between
          px-5 py-4
        "
      >
        <div>
          <h2
            className="
              text-[17px] font-semibold
              text-gray-900

              dark:text-zinc-100
            "
          >
            {t.account ??
              "Account"}
          </h2>

          <p
            className="
              mt-1 text-xs
              text-gray-500

              dark:text-zinc-400
            "
          >
            {t.manage_account ??
              "Manage your account settings"}
          </p>
        </div>

        <ChevronRight
          size={18}
          className="
            text-gray-400
            dark:text-zinc-600
          "
        />
      </div>

      <div
        className="
          h-px bg-gray-100
          dark:bg-zinc-800
        "
      />

      {/* =====================================================
          GRID
      ===================================================== */}

      <div
        className="
          grid grid-cols-4
          gap-y-6
          px-3 py-5
        "
      >
        {items.map(
          (item, index) => (
            <button
              key={index}
              type="button"
              disabled={
                sellerLoading &&
                !!item.onClick
              }
              onClick={() => {
                if (
                  item.onClick
                ) {
                  item.onClick();
                  return;
                }

                if (item.path) {
                  router.push(
                    item.path
                  );
                }
              }}
              className="
                group flex flex-col items-center
                px-1
                transition-transform
                active:scale-95
                disabled:opacity-60
              "
            >
              {/* ICON */}
              <div
                className="
                  relative mb-2
                  flex h-12 w-12
                  items-center justify-center
                  rounded-full

                  border border-gray-100
                  bg-gray-50
                  text-gray-700
                  shadow-sm

                  transition-all

                  group-active:bg-orange-50
                  group-active:text-orange-500

                  dark:border-zinc-800
                  dark:bg-zinc-900
                  dark:text-zinc-200

                  dark:group-active:bg-orange-500/10
                  dark:group-active:text-orange-400
                "
              >
                {item.icon}
              </div>

              {/* LABEL */}
              <span
                className="
                  line-clamp-2
                  max-w-[72px]
                  text-center
                  text-[11px]
                  font-medium
                  leading-tight

                  text-gray-700

                  dark:text-zinc-300
                "
              >
                {item.label}
              </span>
            </button>
          )
        )}
      </div>

      {/* =====================================================
          MESSAGE
      ===================================================== */}

      {sellerMessage && (
        <div
          className={`
            border-t px-4 py-3 text-center text-sm

            dark:border-zinc-800

            ${
              sellerMessage.startsWith(
                "✅"
              )
                ? `
                  border-green-100
                  bg-green-50
                  text-green-700

                  dark:border-green-900/30
                  dark:bg-green-950/30
                  dark:text-green-400
                `
                : `
                  border-red-100
                  bg-red-50
                  text-red-700

                  dark:border-red-900/30
                  dark:bg-red-950/30
                  dark:text-red-400
                `
            }
          `}
        >
          {sellerMessage}
        </div>
      )}

      {/* =====================================================
          FOOT NOTE
      ===================================================== */}

      {!isSeller &&
        !sellerMessage && (
          <div
            className="
              border-t px-4 py-3
              text-center text-xs

              border-gray-100
              text-gray-500

              dark:border-zinc-800
              dark:text-zinc-400
            "
          >
            {t.seller_note ??
              "Bạn có thể đăng ký bán hàng để mở gian hàng của mình."}
          </div>
        )}
    </section>
  );
              }
