import { redirect } from "next/navigation";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { query } from "@/lib/db";
import AdminWithdrawTable from "./AdminWithdrawTable";

export default async function AdminPage() {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">
        Admin Dashboard
      </h1>

      <div className="mt-6 grid gap-4">
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">
            Withdraw Requests
          </h2>
          <p className="text-sm opacity-70">
            Coming soon
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">
            Orders
          </h2>
          <p className="text-sm opacity-70">
            Coming soon
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">
            Sellers
          </h2>
          <p className="text-sm opacity-70">
            Coming soon
          </p>
        </div>
      </div>
    </main>
  );
}
