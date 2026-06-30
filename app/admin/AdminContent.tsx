"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";

import AdminDashboard from "./AdminDashboard";

export default function AdminContent() {
  const {
    user,
    loading,
    piReady,
  } = useAuth();

  const router = useRouter();

  /* =====================================================
     REDIRECT
  ===================================================== */

  useEffect(() => {
    if (loading || !piReady) {
      return;
    }

    if (!user?.is_admin) {
      router.replace("/404");
    }
  }, [
    loading,
    piReady,
    user,
    router,
  ]);

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading || !piReady) {
    return (
      <main className="p-4 space-y-4">
        {Array.from({
          length: 6,
        }).map((_, index) => (
          <div
            key={index}
            className="
              h-24
              animate-pulse
              rounded-xl
              bg-gray-200
            "
          />
        ))}
      </main>
    );
  }

  /* =====================================================
     WAIT REDIRECT
  ===================================================== */

  if (!user?.is_admin) {
    return null;
  }

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <main className="p-4">
      <h1 className="mb-6 text-2xl font-bold">
        Admin Dashboard
      </h1>

      <AdminDashboard />
    </main>
  );
}
