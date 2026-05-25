"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;

    // lấy theme đã lưu
    const savedTheme =
      typeof window !== "undefined"
        ? localStorage.getItem("theme-mode")
        : null;

    const isDark = savedTheme === "dark";

    // reset class
    root.classList.remove(
      "theme-light",
      "theme-dark",
      "theme-seller",
      "theme-customer"
    );

    // base mode (light/dark)
    if (isDark) {
      root.classList.add("theme-dark");
    } else {
      root.classList.add("theme-light");
    }

    // business theme (seller/customer)
    if (pathname.startsWith("/seller")) {
      root.classList.add("theme-seller");
    } else {
      root.classList.add("theme-customer");
    }

    console.log("🎨 theme:", root.className);
  }, [pathname]);

  return <>{children}</>;
}
