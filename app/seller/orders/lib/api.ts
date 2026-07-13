import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

import {
  normalizeOrder,
} from "./helpers";

import type {
  Order,
  RawOrder,
} from "../types";

/* =========================================================
   GET ORDERS
========================================================= */

export async function getOrders(): Promise<Order[]> {
  const res = await apiAuthFetch(
    "/api/seller/orders",
    {
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(
      "LOAD_ORDERS_FAILED"
    );
  }

  const data =
    (await res.json()) as RawOrder[];

  return data.map(
    normalizeOrder
  );
}

/* =========================================================
   CONFIRM ORDER
========================================================= */

export async function confirmOrder(
  orderId: string,
  sellerMessage: string
): Promise<void> {
  const res = await apiAuthFetch(
    `/api/seller/orders/${orderId}/confirm`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        seller_message: sellerMessage,
      }),
    }
  );

  if (!res.ok) {
    throw new Error("CONFIRM_FAILED");
  }
}

/* =========================================================
   CANCEL ORDER
========================================================= */

export async function cancelOrder(
  orderId: string,
  reason: string
): Promise<void> {
  const res = await apiAuthFetch(
    `/api/seller/orders/${orderId}/cancel`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cancel_reason: reason,
      }),
    }
  );

  if (!res.ok) {
    throw new Error("CANCEL_FAILED");
  }
}

/* =========================================================
   START SHIPPING
========================================================= */

export async function startShipping(
  orderId: string
): Promise<void> {
  const res = await apiAuthFetch(
    `/api/seller/orders/${orderId}/shipping`,
    {
      method: "PATCH",
    }
  );

  if (!res.ok) {
    throw new Error("SHIPPING_FAILED");
  }
}
