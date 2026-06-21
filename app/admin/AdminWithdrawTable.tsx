"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

type Row = {
  id: string;
  user_id: string;
  amount: string;
  currency: string;
  withdraw_wallet: string;
  status: string;
  requested_at: string;
};

export default function AdminWithdrawTable() {
  const { t } = useTranslation();

  const {
    user,
    loading: authLoading,
    piReady,
  } = useAuth();

  const [rows, setRows] = useState<Row[]>([]);
  const [tableLoading, setTableLoading] =
    useState(true);

  useEffect(() => {
    if (
      authLoading ||
      !piReady ||
      !user
    ) {
      return;
    }

    void loadWithdraws();
  }, [
    authLoading,
    piReady,
    user,
  ]);

  async function loadWithdraws() {
    try {
      const res =
        await apiAuthFetch(
          "/api/admin/withdraws"
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error ??
            "LOAD_FAILED"
        );
      }

      setRows(
        Array.isArray(
          data?.rows
        )
          ? data.rows
          : []
      );
    } catch (err) {
      console.error(
        "[ADMIN_WITHDRAWS]",
        err
      );
    } finally {
      setTableLoading(
        false
      );
    }
  }

  if (
    authLoading ||
    tableLoading
  ) {
    return (
      <div className="p-4">
        {t.loading ??
          "Loading..."}
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border">
        <thead>
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Wallet</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.id}</td>
              <td>{row.user_id}</td>
              <td>
                {row.wallet_address}
              </td>
              <td>
                {row.amount} π
              </td>
              <td>
                {row.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!rows.length && (
        <div className="p-4 text-center">
          No withdraw requests
        </div>
      )}
    </div>
  );
}
