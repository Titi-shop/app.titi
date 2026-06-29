"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import {
  Suspense,
} from "react";

import {
  useAuth,
} from "@/context/AuthContext";

import AdminWithdrawTable
  from "./AdminWithdrawTable";

/* =====================================================
   CONTENT
===================================================== */

function AdminContent() {

  const {
    user,
    loading,
    piReady,
  } = useAuth();

  /* ================= LOADING ================= */

  if (
    loading ||
    !piReady
  ) {
    return (
      <main className="p-4 space-y-4">
        {Array.from({
          length: 4,
        }).map((_, i) => (
          <div
            key={i}
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

  /* ================= ADMIN ================= */

  if (
    !user?.is_admin
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <h1 className="text-xl font-semibold">
          404
        </h1>
      </main>
    );
  }

  /* ================= PAGE ================= */

  return (
    <main className="p-4">

      <h1 className="mb-6 text-2xl font-bold">
        Admin Dashboard
      </h1>

      <AdminWithdrawTable />

    </main>
  );
}

/* =====================================================
   PAGE
===================================================== */

export default function AdminPage() {

  return (
    <Suspense
      fallback={
        <main className="p-4 space-y-4">
          {Array.from({
            length: 4,
          }).map((_, i) => (
            <div
              key={i}
              className="
                h-24
                animate-pulse
                rounded-xl
                bg-gray-200
              "
            />
          ))}
        </main>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
