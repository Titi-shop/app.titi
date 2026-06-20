import type {
  PaymentIntentRow,
  FinalizePaidOrderParams,
  FinalizePaidOrderResult,
  ShippingSnapshot,
  RpcPayload,
  PiPayload,
} from "@/lib/payments/types";

/* =========================================================
   RE-EXPORT CORE TYPES
========================================================= */

export type {
  PaymentIntentRow,
  FinalizePaidOrderParams,
  FinalizePaidOrderResult,
  ShippingSnapshot,
  RpcPayload,
  PiPayload,
};

/* =========================================================
   RECEIPT VALIDATION
========================================================= */

export type ReceiptVerificationRow = {
  verification_status: string;
  verify_source: string;

  rpc_confirmed: boolean;

  rpc_tx_status: string;
  rpc_reason: string;
};

/* =========================================================
   EXISTING ORDER LOOKUP
========================================================= */

export type ExistingOrderRow = {
  id: string;
};

/* =========================================================
   FINALIZE RESULT
========================================================= */

export type FinalizedOrderResult = {
  ok: boolean;
  already: boolean;

  orderId: string | null;

  buyerId: string;
  sellerId: string;

  amount: number;
};

/* =========================================================
   SHIPPING SNAPSHOT PARSED
========================================================= */

export type ParsedShippingSnapshot = {
  shipping: ShippingSnapshot;
  pricing: {
    subtotal: number;
    shipping_fee: number;
    total: number;

    items: Array<{
      product_id: string;
      variant_id: string | null;

      quantity: number;

      unit_price: number;
      subtotal: number;
    }>;
  };
};

/* =========================================================
   STRICT PAYMENT VALIDATION INPUT
========================================================= */

export type StrictPaymentValidationInput = {
  paymentIntentId: string;

  expectedAmount: number;
  verifiedAmount: number;

  merchantWallet: string;
  receiverWallet: string;

  txid: string;

  rpcPayload: RpcPayload;
};

/* =========================================================
   RECEIPT UPSERT INPUT
========================================================= */

export type UpsertReceiptInput = {
  paymentIntentId: string;
  orderId: string;

  expectedAmount: number;
  verifiedAmount: number;

  piPaymentId: string;
  txid: string;

  buyerId: string;

  receiverWallet: string;

  piPayload: PiPayload;
  rpcPayload: RpcPayload;
};

/* =========================================================
   PI PAYMENTS UPSERT INPUT
========================================================= */

export type UpsertPiPaymentsInput = {
  paymentIntentId: string;
  orderId: string;

  buyerId: string;

  piPaymentId: string;
  txid: string;

  expectedAmount: number;
  verifiedAmount: number;

  receiverWallet: string;

  country: string | null;
  zone: string | null;

  piPayload: PiPayload;
  rpcPayload: RpcPayload;
};

export type ExistingOrderRow = {
  id: string;
};

export type AlreadyPaidResult = {
  ok: boolean;
  already: boolean;

  orderId: string | null;

  buyerId: string;
  sellerId: string;

  amount: number;
};

export type FinalizeIntentInput = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
};

export type FindExistingOrderInput = {
  piPaymentId: string;

  buyerId: string;
  sellerId: string;

  amount: number;
};
export type UpsertPiPaymentInput = {
  paymentIntentId: string;

  orderId: string;

  buyerId: string;

  piPaymentId: string;
  txid: string;

  expectedAmount: number;
  verifiedAmount: number;

  receiverWallet: string;

  country: string | null;
  zone: string | null;

  piPayload: PiPayload;
  rpcPayload: RpcPayload;
};

export type UpsertPaymentReceiptInput = {
  paymentIntentId: string;

  orderId: string;

  buyerId: string;

  expectedAmount: number;
  verifiedAmount: number;

  piPaymentId: string;
  txid: string;

  receiverWallet: string;

  piPayload: PiPayload;
  rpcPayload: RpcPayload;
};

