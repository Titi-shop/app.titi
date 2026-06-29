import { notFound } from "next/navigation";

import {
  requireAdmin,
} from "@/lib/auth/guard";

import AdminWithdrawTable
  from "./AdminWithdrawTable";

export default async function AdminPage() {

  const auth = await requireAdmin();

console.log("[ADMIN_PAGE]", auth);

if (!auth.ok) {
  return (
    <pre>
      {JSON.stringify(auth, null, 2)}
    </pre>
  );
}
