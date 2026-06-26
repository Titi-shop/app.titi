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

  const [rows, setRows] =
    useState<Row[]>([]);

  const [
    tableLoading,
    setTableLoading,
  ] = useState(true);

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
    console.log(
      "[ADMIN_WITHDRAWS][LOAD_START]"
    );

    const res =
      await apiAuthFetch(
        "/api/admin/withdraws"
      );

    console.log(
      "[ADMIN_WITHDRAWS][HTTP]",
      {
        status: res.status,
      }
    );

    const data =
      await res.json();

    console.log(
      "[ADMIN_WITHDRAWS][DATA]",
      data
    );

    if (!res.ok) {
      throw new Error(
        data?.error ??
          "LOAD_FAILED"
      );
    }

    const nextRows =
      Array.isArray(
        data?.rows
      )
        ? data.rows
        : [];

    console.log(
      "[ADMIN_WITHDRAWS][ROWS]",
      {
        count:
          nextRows.length,
      }
    );

    if (
      nextRows.length > 0
    ) {
      console.log(
        "[ADMIN_WITHDRAWS][FIRST_ROW]",
        nextRows[0]
      );
    }

    setRows(nextRows);
  } catch (err) {
    console.error(
      "[ADMIN_WITHDRAWS][ERROR]",
      err
    );
  } finally {
    console.log(
      "[ADMIN_WITHDRAWS][DONE]"
    );

    setTableLoading(
      false
    );
  }
}
async function handleApprove(
  withdrawalId: string
) {
  try {
    console.log(
      "[ADMIN_APPROVE][START]",
      { withdrawalId }
    );

    const res =
      await apiAuthFetch(
        `/api/admin/withdraws/${withdrawalId}/approve`,
        {
          method: "POST",
        }
      );

    const data =
      await res.json();

    console.log(
      "[ADMIN_APPROVE][RESULT]",
      data
    );

    if (!res.ok) {
      throw new Error(
        data?.error ??
        "APPROVE_FAILED"
      );
    }

    await loadWithdraws();

    alert(
      "Withdrawal approved"
    );
  } catch (err) {
    console.error(
      "[ADMIN_APPROVE][ERROR]",
      err
    );

    alert(
      "Approve failed"
    );
  }
}
async function handlePay(
  withdrawalId: string
) {
  try {
    console.log(
      "[ADMIN_PAY][START]",
      {
        withdrawalId,
      }
    );

    const res =
      await apiAuthFetch(
        `/api/admin/withdraws/${withdrawalId}/pay`,
        {
          method: "POST",
        }
      );

    console.log(
      "[ADMIN_PAY][HTTP]",
      {
        status: res.status,
      }
    );

    const data =
      await res.json();

    console.log(
      "[ADMIN_PAY][RESPONSE]",
      data
    );

    if (!res.ok) {
      throw new Error(
        data?.error ??
          "PAY_FAILED"
      );
    }

    console.log(
      "[ADMIN_PAY][RELOAD]"
    );

    await loadWithdraws();

    console.log(
      "[ADMIN_PAY][SUCCESS]"
    );

    alert(
      t.pay_marked_processing ??
        "Withdrawal marked as processing"
    );
  } catch (err) {
    console.error(
      "[ADMIN_PAY][ERROR]",
      err
    );

    alert(
      t.pay_failed ??
        "Payment failed"
    );
  }
}
  async function handleRetry(
  withdrawalId: string
) {
  try {
    const res =
      await apiAuthFetch(
        `/api/admin/withdraws/${withdrawalId}/retry`,
        {
          method: "POST",
        }
      );

    const data =
      await res.json();

    if (!res.ok) {
      throw new Error(
        data?.error ??
          "RETRY_FAILED"
      );
    }

    await loadWithdraws();

    alert(
      "Withdrawal moved back to APPROVED"
    );
  } catch (err) {
    console.error(
      "[ADMIN_RETRY][ERROR]",
      err
    );

    alert(
      "Retry failed"
    );
  }
}
  async function handleSync(
  withdrawalId: string
) {
  try {
    console.log(
      "[ADMIN_SYNC][START]",
      {
        withdrawalId,
      }
    );

    const res =
      await apiAuthFetch(
        `/api/admin/withdraws/${withdrawalId}/sync`,
        {
          method: "POST",
        }
      );

    console.log(
      "[ADMIN_SYNC][HTTP]",
      {
        status: res.status,
      }
    );

    const data =
      await res.json();

    console.log(
      "[ADMIN_SYNC][RESPONSE]",
      data
    );

    if (!res.ok) {
      throw new Error(
        data?.error ??
          "SYNC_FAILED"
      );
    }

    await loadWithdraws();

    alert(
      "Withdrawal synced"
    );
  } catch (err) {
    console.error(
      "[ADMIN_SYNC][ERROR]",
      err
    );

    alert(
      "Sync failed"
    );
  }
}
  async function handleResume(
  withdrawalId: string
) {
  try {
    console.log(
      "[ADMIN_RESUME][START]",
      {
        withdrawalId,
      }
    );

    const res =
      await apiAuthFetch(
        `/api/admin/withdraws/${withdrawalId}/resume`,
        {
          method: "POST",
        }
      );

    console.log(
      "[ADMIN_RESUME][HTTP]",
      {
        status: res.status,
      }
    );

    const data =
      await res.json();

    console.log(
      "[ADMIN_RESUME][RESPONSE]",
      data
    );

    if (!res.ok) {
      throw new Error(
        data?.error ??
          "RESUME_FAILED"
      );
    }

    await loadWithdraws();

    alert(
      "Withdrawal resumed"
    );
  } catch (err) {
    console.error(
      "[ADMIN_RESUME][ERROR]",
      err
    );

    alert(
      "Resume failed"
    );
  }
}
  
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div
          key={row.id}
          className="
            rounded-xl
            border
            p-4
            shadow-sm
          "
        >
          <div className="flex justify-between">
            <div>
              <div className="font-semibold">
                {row.amount} π
              </div>

              <div className="text-xs opacity-70">
                {row.status}
              </div>
            </div>

            <div className="text-xs opacity-70">
              {new Date(
                row.requested_at
              ).toLocaleString()}
            </div>
          </div>

          <div className="mt-3">
            <div className="text-xs opacity-70">
              User ID
            </div>

            <div className="break-all text-sm">
              {row.user_id}
            </div>
          </div>

          <div className="mt-3">
            <div className="text-xs opacity-70">
              Withdraw Wallet
            </div>

            <div className="break-all text-sm">
              {row.withdraw_wallet}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
           <button
  onClick={() =>
    void handleApprove(
      row.id
    )
  }
  disabled={
    row.status !==
    "PENDING"
  }
  className="
    rounded-lg
    border
    px-3
    py-2
    text-sm
  "
>
  Approve
</button>

<button
  onClick={() =>
    void handlePay(
      row.id
    )
  }
  disabled={
    row.status !==
    "APPROVED"
  }
  className="
    rounded-lg
    border
    px-3
    py-2
    text-sm
  "
>
  Pay
</button>
            <button
  onClick={() =>
    void handleRetry(
      row.id
    )
  }
  disabled={
    row.status !==
    "FAILED"
  }
  className="
    rounded-lg
    border
    px-3
    py-2
    text-sm
  "
>
  Retry
</button>
<button
  onClick={() =>
    void handleSync(
      row.id
    )
  }
  disabled={
    row.status !==
      "PROCESSING" &&
    row.status !==
      "APPROVED"
  }
  className="
    rounded-lg
    border
    px-3
    py-2
    text-sm
  "
>
  Sync
</button>
            <button
  onClick={() =>
    void handleResume(
      row.id
    )
  }
  disabled={
    row.status !==
    "PROCESSING"
  }
  className="
    rounded-lg
    border
    px-3
    py-2
    text-sm
  "
>
  Resume
</button>
            <button
              className="
                rounded-lg
                border
                px-3
                py-2
                text-sm
              "
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
