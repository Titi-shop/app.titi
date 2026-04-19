"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

export default function SellerReturnDetail() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await apiAuthFetch(`/api/seller/returns/${id}`);
    const json = await res.json();
    setData(json);
  }

  async function action(type: string) {
    await apiAuthFetch(`/api/seller/returns/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: type }),
    });

    await load();
  }

  if (!data) return <p className="p-4">Loading...</p>;

  return (
    <main className="p-4 space-y-4">

      <h1 className="text-lg font-bold">
        Return #{data.id}
      </h1>

      <p>Status: {data.status}</p>

      <p>Reason: {data.reason}</p>

      {/* ACTIONS */}
      {data.status === "pending" && (
        <div className="flex gap-2">
          <button
            onClick={() => action("approve")}
            className="bg-green-500 text-white px-3 py-2 rounded"
          >
            Approve
          </button>

          <button
            onClick={() => action("reject")}
            className="bg-red-500 text-white px-3 py-2 rounded"
          >
            Reject
          </button>
        </div>
      )}

      {data.status === "shipping_back" && (
        <button
          onClick={() => action("received")}
          className="bg-blue-500 text-white px-3 py-2 rounded"
        >
          Mark Received
        </button>
      )}

    </main>
  );
}
