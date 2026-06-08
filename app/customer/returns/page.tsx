"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

import { ReturnRecord } from "./types/returns";

import ReturnList from "./components/ReturnList";
import ReturnSkeleton from "./components/ReturnSkeleton";

export default function ReturnsPage() {
  const { user, loading: authLoading } = useAuth();

  const [returns, setReturns] =
    useState<ReturnRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    loadReturns();
  }, [authLoading, user]);

  async function loadReturns() {
    try {
      const res =
        await apiAuthFetch("/api/returns");

      if (!res.ok) {
        setReturns([]);
        return;
      }

      const json = await res.json();

      setReturns(
        Array.isArray(json?.items)
          ? json.items
          : []
      );
    } finally {
      setLoading(false);
    }
  }

  const sortedReturns = useMemo(
    () =>
      [...returns].sort(
        (a, b) =>
          new Date(
            b.created_at ?? 0
          ).getTime() -
          new Date(
            a.created_at ?? 0
          ).getTime()
      ),
    [returns]
  );

  if (loading || authLoading) {
    return <ReturnSkeleton />;
  }

  return (
    <ReturnList
      returns={sortedReturns}
    />
  );
}
