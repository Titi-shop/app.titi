"use client";
import useSWR from "swr";
import { useEffect, useState } from "react";
import Image from "next/image";
import { UserCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* =========================
   TYPES (NO any)
========================= */
interface Profile {
  avatar?: string | null;
  avatar_url?: string | null;
}
const fetchProfile = async (): Promise<Profile | null> => {
  try {
    const token = await getPiAccessToken();

    const res = await fetch("/api/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;

    const raw: unknown = await res.json();

    if (
      typeof raw === "object" &&
      raw !== null &&
      "profile" in raw
    ) {
      const profile = (raw as { profile?: Profile }).profile;
      return profile ?? null;
    }

    return null;
  } catch {
    return null;
  }
};

/* =========================
   COMPONENT
========================= */
export default function AccountHeader() {
  const { user } = useAuth();
  const { t } = useTranslation();
   const { data: profile } = useSWR(
  user ? "profile" : null,
  fetchProfile,
  {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  }
);

  /* =========================
     LOAD PROFILE (NETWORK–FIRST)
  ========================= */
const avatar =
  profile?.avatar_url ??
  profile?.avatar ??
  null;

  if (!user) return null;

  /* =========================
     RENDER
  ========================= */
  return (
    <section className="bg-orange-500 text-white p-6 text-center shadow">
      {/* AVATAR */}
      <div className="w-24 h-24 bg-white rounded-full mx-auto overflow-hidden shadow flex items-center justify-center">
        {avatar ? (
          <Image
            src={avatar}
            alt="Avatar"
            width={96}
            height={96}
            className="object-cover"
          />
        ) : (
          <UserCircle size={56} className="text-orange-500" />
        )}
      </div>

      {/* USERNAME */}
      <p className="mt-3 text-lg font-semibold">
        @{user.username}
      </p>

      {/* ROLE */}
      <p className="text-xs opacity-90">
        {user.role === "seller"
          ? t.seller
          : user.role === "admin"
          ? t.admin
          : t.customer}
      </p>
    </section>
  );
}
