"use client";

import { useEffect } from "react";

export default function PiProvider() {
  useEffect(() => {
    const timer = setInterval(async () => {
      if (typeof window === "undefined" || !window.Pi) {
        return;
      }

      if (window.__pi_initialized) {
        clearInterval(timer);
        return;
      }

      try {
        const result = window.Pi.init({
          version: "2.0",
          sandbox: false,
        });

        // tương thích cả init sync và Promise
        await Promise.resolve(result);

        window.__pi_initialized = true;

        console.log("✅ Pi SDK initialized");
      } catch (err) {
        console.error("❌ Pi SDK init failed:", err);
      } finally {
        clearInterval(timer);
      }
    }, 500);

    return () => clearInterval(timer);
  }, []);

  return null;
}
