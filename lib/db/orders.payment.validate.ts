import { auditManualReview } from "@/lib/db/payments.audit";

import type { PoolClient } from "pg";

import type {
  RpcPayload,
  ShippingSnapshot,
  StrictPaymentValidationInput,
} from "./orders.payment.types";

/* =========================================================
   HELPERS
========================================================= */

export function toNumber(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error("INVALID_NUMBER");
  }

  return parsed;
}

export function isSameAmount(
  left: number,
  right: number
): boolean {
  return Math.abs(left - right) < 0.0000001;
}

/* =========================================================
   SHIPPING SNAPSHOT
========================================================= */

type PricingSnapshotItem = {
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type PricingSnapshot = {
  subtotal: number;
  shipping_fee: number;
  total: number;
  items: PricingSnapshotItem[];
};

type ShippingSnapshotPayload = {
  buyer_shipping?: ShippingSnapshot;
  pricing_snapshot?: PricingSnapshot;
};

export function parseShippingSnapshot(
  rawSnapshot: unknown
): {
  shipping: ShippingSnapshot;
  pricing: PricingSnapshot;
} {
  const snapshot: ShippingSnapshotPayload =
    typeof rawSnapshot === "string"
      ? (JSON.parse(rawSnapshot) as ShippingSnapshotPayload)
      : (rawSnapshot as ShippingSnapshotPayload);

  const shipping =
    snapshot.buyer_shipping ??
    (snapshot as unknown as ShippingSnapshot);

  const pricing = snapshot.pricing_snapshot;

  if (!pricing) {
    throw new Error(
      "PRICING_SNAPSHOT_MISSING"
    );
  }

  return {
    shipping,
    pricing,
  };
}

/* =========================================================
   SHIPPING VALIDATION
========================================================= */

export async function validateShippingSnapshot(
  paymentIntentId: string,
  shipping: ShippingSnapshot,
  client: PoolClient
): Promise<void> {
  if (
    !shipping.name ||
    !shipping.phone ||
    !shipping.address_line
  ) {
    await auditManualReview(
      paymentIntentId,
      "INVALID_SHIPPING_SNAPSHOT",
      { shipping },
      client
    );

    throw new Error(
      "INVALID_SHIPPING_SNAPSHOT"
    );
  }
}

/* =========================================================
   RPC VALIDATION
========================================================= */

export async function validateRpcPayload(
  paymentIntentId: string,
  rpcPayload: RpcPayload,
  client: PoolClient
): Promise<void> {
  if (!rpcPayload.confirmed) {
    await auditManualReview(
      paymentIntentId,
      "RPC_NOT_CONFIRMED",
      rpcPayload,
      client
    );

    throw new Error(
      "RPC_NOT_CONFIRMED"
    );
  }

  if (
    rpcPayload.txStatus !==
    "SUCCESS"
  ) {
    await auditManualReview(
      paymentIntentId,
      "RPC_TX_FAILED",
      rpcPayload,
      client
    );

    throw new Error(
      "RPC_TX_FAILED"
    );
  }

  if (
    rpcPayload.reason &&
    rpcPayload.reason !== "NONE"
  ) {
    await auditManualReview(
      paymentIntentId,
      "RPC_REASON_FAILED",
      rpcPayload,
      client
    );

    throw new Error(
      "RPC_REASON_FAILED"
    );
  }

  if (!rpcPayload.ledger) {
    await auditManualReview(
      paymentIntentId,
      "RPC_LEDGER_MISSING",
      rpcPayload,
      client
    );

    throw new Error(
      "RPC_LEDGER_MISSING"
    );
  }
}

/* =========================================================
   STRICT PAYMENT VALIDATION
========================================================= */

export async function validateStrictPayment(
  input: StrictPaymentValidationInput,
  client: PoolClient
): Promise<void> {
  const {
    paymentIntentId,
    expectedAmount,
    verifiedAmount,
    merchantWallet,
    receiverWallet,
    txid,
    rpcPayload,
  } = input;

  if (
    !isSameAmount(
      expectedAmount,
      verifiedAmount
    )
  ) {
    await auditManualReview(
      paymentIntentId,
      "AMOUNT_MISMATCH",
      {
        expectedAmount,
        verifiedAmount,
      },
      client
    );

    throw new Error(
      "AMOUNT_MISMATCH"
    );
  }

  if (
    merchantWallet
      .trim()
      .toLowerCase() !==
    receiverWallet
      .trim()
      .toLowerCase()
  ) {
    await auditManualReview(
      paymentIntentId,
      "RECEIVER_MISMATCH",
      {
        expected: merchantWallet,
        got: receiverWallet,
      },
      client
    );

    throw new Error(
      "RECEIVER_MISMATCH"
    );
  }

  if (!txid) {
    await auditManualReview(
      paymentIntentId,
      "TXID_MISSING",
      {},
      client
    );

    throw new Error(
      "TXID_MISSING"
    );
  }

  if (
    rpcPayload.chainReference &&
    rpcPayload.chainReference !== txid
  ) {
    await auditManualReview(
      paymentIntentId,
      "TXID_MISMATCH",
      {
        txid,
        chainReference:
          rpcPayload.chainReference,
      },
      client
    );

    throw new Error(
      "TXID_MISMATCH"
    );
  }

  await validateRpcPayload(
    paymentIntentId,
    rpcPayload,
    client
  );
}
