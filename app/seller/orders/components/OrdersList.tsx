"use client";

import OrderCard from "./OrderCard";
import OrderActions from "./OrderActions";

import type {
  Order,
  OrderStatus,
} from "../types";

type Props = {
  orders: Order[];

  loadingId?: string | null;

  onDetail: (id: string) => void;

  onConfirm: (id: string) => void;

  onCancel: (id: string) => void;

  onShipping: (id: string) => void;
};

export default function OrdersList({
  orders,
  loadingId,

  onDetail,
  onConfirm,
  onCancel,
  onShipping,
}: Props) {
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-20 text-center text-gray-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        Không có đơn hàng.
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {orders.map((order) => (

        <OrderCard
          key={order.id}
          order={order}
          onClick={() =>
            onDetail(order.id)
          }
          actions={
            <OrderActions
              orderId={order.id}
              status={
                order.fulfillment_status as OrderStatus
              }
              loading={
                loadingId ===
                order.id
              }
              onDetail={() =>
                onDetail(order.id)
              }
              onConfirm={() =>
                onConfirm(order.id)
              }
              onCancel={() =>
                onCancel(order.id)
              }
              onShipping={() =>
                onShipping(order.id)
              }
            />
          }
        />

      ))}

    </div>
  );
}
