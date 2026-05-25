"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";

import {
  Bell,
  Compass,
  Grid2X2,
  Home,
  Search,
  ShoppingCart,
  User2,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

export default function BottomNav() {
  const pathname = usePathname();

  const { t } = useTranslation();

  const [hidden, setHidden] =
    useState(false);

  const [lastScroll, setLastScroll] =
    useState(0);

  /* =========================================================
     HIDE ON SCROLL
  ========================================================= */

  useEffect(() => {
    const handleScroll = () => {
      const current =
        window.scrollY || 0;

      if (
        current > lastScroll &&
        current > 80
      ) {
        setHidden(true);
      } else {
        setHidden(false);
      }

      setLastScroll(current);
    };

    window.addEventListener(
      "scroll",
      handleScroll
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll
      );
    };
  }, [lastScroll]);

  /* =========================================================
     NAV ITEMS
  ========================================================= */

  const navItems = useMemo(
    () => [
      {
        href: "/",
        label:
          t.home || "Home",
        icon: Home,
      },

      {
        href: "/categories",
        label:
          t.categories ||
          "Categories",
        icon: Grid2X2,
      },

      {
        href: "/discover",
        label:
          t.discover ||
          "Discover",
        icon: Compass,
        center: true,
      },

      {
        href: "/notifications",
        label:
          t.notifications ||
          "Alerts",
        icon: Bell,
        badge: 2,
      },

      {
        href: "/account",
        label:
          t.me || "Me",
        icon: User2,
      },
    ],
    [t]
  );

  /* =========================================================
     UI
  ========================================================= */

  return (
    <>
      {/* SPACER */}

      <div className="h-[95px]" />

      <nav
        className={`
          fixed bottom-0 left-0 right-0 z-50
          transition-all duration-500
          ${
            hidden
              ? "translate-y-full opacity-0"
              : "translate-y-0 opacity-100"
          }
        `}
        style={{
          paddingBottom:
            "env(safe-area-inset-bottom)",
        }}
      >
        {/* OUTER */}

        <div className="mx-auto max-w-xl px-4 pb-4">
          {/* CONTAINER */}

          <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-black/80 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-3xl">
            {/* BACKGROUND */}

            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />

              <div className="absolute -top-10 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />
            </div>

            {/* ITEMS */}

            <div className="relative z-10 flex h-[78px] items-center justify-around px-2">
              {navItems.map(
                ({
                  href,
                  label,
                  icon: Icon,
                  badge,
                  center,
                }) => {
                  const active =
                    pathname === href ||
                    (href !== "/" &&
                      pathname.startsWith(
                        href
                      ));

                  return (
                    <Link
                      key={href}
                      href={href}
                      className="relative flex flex-1 items-center justify-center"
                    >
                      {/* CENTER BUTTON */}

                      {center ? (
                        <div className="relative -mt-10 flex flex-col items-center">
                          <div
                            className={`
                              flex h-[62px] w-[62px]
                              items-center justify-center
                              rounded-[24px]
                              border border-orange-400/30
                              bg-gradient-to-br
                              from-orange-500
                              to-orange-600
                              shadow-[0_10px_35px_rgba(249,115,22,0.45)]
                              transition-all duration-300
                              ${
                                active
                                  ? "scale-110"
                                  : ""
                              }
                            `}
                          >
                            <Compass
                              size={28}
                              className="text-white"
                            />
                          </div>

                          <span className="mt-2 text-[11px] font-semibold text-orange-300">
                            {label}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          {/* ICON */}

                          <div className="relative">
                            {/* ACTIVE GLOW */}

                            {active && (
                              <div className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl" />
                            )}

                            <div
                              className={`
                                relative flex h-12 w-12
                                items-center justify-center
                                rounded-2xl
                                transition-all duration-300
                                ${
                                  active
                                    ? "bg-orange-500/15"
                                    : "bg-transparent"
                                }
                              `}
                            >
                              <Icon
                                size={22}
                                className={`
                                  transition-all duration-300
                                  ${
                                    active
                                      ? "scale-110 text-orange-400"
                                      : "text-white/45"
                                  }
                                `}
                              />
                            </div>

                            {/* BADGE */}

                            {badge ? (
                              <div className="absolute -right-1 top-0 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg">
                                {badge}
                              </div>
                            ) : null}
                          </div>

                          {/* LABEL */}

                          <span
                            className={`
                              mt-1 text-[11px]
                              transition-all duration-300
                              ${
                                active
                                  ? "font-semibold text-orange-300"
                                  : "text-white/35"
                              }
                            `}
                          >
                            {label}
                          </span>
                        </div>
                      )}
                    </Link>
                  );
                }
              )}
            </div>

            {/* ACTIVE LINE */}

            <BottomIndicator
              pathname={pathname}
            />
          </div>
        </div>
      </nav>
    </>
  );
}

/* =========================================================
   ACTIVE INDICATOR
========================================================= */

function BottomIndicator({
  pathname,
}: {
  pathname: string;
}) {
  const routes = [
    "/",
    "/categories",
    "/discover",
    "/notifications",
    "/account",
  ];

  const index = routes.findIndex(
    (route) =>
      pathname === route ||
      (route !== "/" &&
        pathname.startsWith(route))
  );

  return (
    <div
      className="absolute bottom-0 left-0 flex w-1/5 justify-center transition-all duration-500"
      style={{
        transform: `translateX(${
          index * 100
        }%)`,
      }}
    >
      <div className="h-1.5 w-10 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 shadow-[0_0_20px_rgba(249,115,22,0.8)]" />
    </div>
  );
                          }
