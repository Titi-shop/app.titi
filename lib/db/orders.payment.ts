
import { withTransaction } from "@/lib/db";
import { createOrder } from "@/lib/db/orders.create";
import { getRpcVerificationLog } from "@/lib/db/payments.rpc";
import {
  writePaymentAudit,
  auditPaymentReceiptCreated,
  auditPiPaymentCreated,
  auditPaymentIntentFinalized,
  auditFinalizeDone,
} from "@/lib/db/payments.audit";
import {
  getPaymentIntent,
} from "@/lib/db/payments.intent";
import {
  validateFinalizePayment,
} from "@/lib/db/orders.payment.validate";

import {
  upsertPaymentReceipt,
  linkReceiptSettlement,
  linkReceiptSettlementByIds,
} from "@/lib/db/orders.payment.receipt";
import {
  sendNotification,
} from "@/lib/services/notifications.service";
import {
  upsertPiPayment,
} from "@/lib/db/orders.payment.pi-payments";

import {
  finalizePaymentIntent,
} from "@/lib/db/orders.payment.intent";
import {
  createEscrow,
  markPiVerified,
  markRpcVerified,
  linkOrder,
  creditSeller,
} from "@/lib/db/settlement";
import type {
  FinalizePaidOrderParams,
  FinalizePaidOrderResult,
  PaymentIntentRow,
} from "@/lib/db/orders.payment.types";

export async function finalizePaidOrderFromIntent(
  params: FinalizePaidOrderParams
): Promise<FinalizePaidOrderResult> {
  const result =
    await withTransaction(async (client) => {
    const {
  paymentIntentId,
  piPaymentId,
  txid,
  verifiedAmount,
  receiverWallet,
  piPayload,
} = params;
const rpcPayload =
  await getRpcVerificationLog(paymentIntentId);
    if (!rpcPayload.verified) {
  throw new Error("RPC_NOT_VERIFIED");
}
    const intent =
  await getPaymentIntent(
    paymentIntentId
  );
if (!intent) {
  throw new Error(
    "PAYMENT_INTENT_NOT_FOUND"
  );
}
    const validation =
      await validateFinalizePayment({
        client,
        paymentIntentId,
        txid,
        verifiedAmount,
        receiverWallet,
        rpcPayload,
        intent,
      });

    const {
      shipping,
      pricing,
      expectedAmount,
    } = validation;

    if (intent.status === "paid") {
      const existedOrder =
        await client.query<{
          id: string;
        }>(
          `
          SELECT id
          FROM orders
          WHERE pi_payment_id = $1
          LIMIT 1
          `,
          [piPaymentId]
        );

      return {
        ok: true,
        already: true,
        orderId:
          existedOrder.rows[0]?.id ??
          null,
        buyerId:
          intent.buyer_id,
        sellerId:
          intent.seller_id,
        amount:
          verifiedAmount,
      };
    }

    if (
      intent.status !== "verifying" &&
      intent.status !== "submitted" &&
      intent.status !== "wallet_opened"
    ) {
      throw new Error(
        "INVALID_PAYMENT_STATUS"
      );
    }

    const existingOrder =
      await client.query<{
        id: string;
      }>(
        `
        SELECT id
        FROM orders
        WHERE pi_payment_id = $1
        LIMIT 1
        `,
        [piPaymentId]
      );

    if (existingOrder.rows.length > 0) {
      return {
        ok: true,
        already: true,
        orderId:
          existingOrder.rows[0].id,
        buyerId:
          intent.buyer_id,
        sellerId:
          intent.seller_id,
        amount:
          verifiedAmount,
      };
    }

    await writePaymentAudit(
  {
    paymentIntentId,
    eventCode: "ORDER_FINALIZE_STARTED",
    stage: "FINALIZE",
    actorType: "system",
    piPaymentId,
    txid,
    source: "orders.payment",
    newSettlementState: "FINALIZING_ORDER",
    payload: {
      verifiedAmount,
      receiverWallet,
    },
  },
  client
);

    const createdOrder =
      await createOrder({
        userId:
          intent.buyer_id,
        piPaymentId,
        txid,
        idempotencyKey:
          paymentIntentId,
        country:
          intent.country,
        zone:
          intent.zone,
        shipping,
        pricing,
        items: [
          {
            product_id:
              intent.product_id,

            variant_id:
              intent.variant_id,

            quantity:
              intent.quantity,
          },
        ],
      });

    const orderId =
      createdOrder.orderId;

    if (!orderId) {
      throw new Error(
        "ORDER_CREATE_FAILED"
      );
    }

    await writePaymentAudit(
  {
    paymentIntentId,
    eventCode: "ORDER_CREATED",
    stage: "FINALIZE",
    actorType: "system",
    piPaymentId,
    txid,
    source: "orders.payment",
    orderId,
    newSettlementState: "ORDER_CREATED",
  },
  client
);

    await upsertPaymentReceipt(
  client,
  {
    paymentIntentId,
    buyerId: intent.buyer_id,
    orderId,
    piPaymentId,
    txid,
    expectedAmount,
    verifiedAmount,
    receiverWallet,
    piPayload,
  }
);
await auditPaymentReceiptCreated(
  paymentIntentId,
  {
    source: "orders.payment",
    orderId,
    piPaymentId,
    txid,
  },
  client
);
    await upsertPiPayment(
  client,
  {
    paymentIntentId,
    orderId,
    buyerId: intent.buyer_id,
    country: intent.country,
    zone: intent.zone,
    piPaymentId,
    txid,
    expectedAmount,
    verifiedAmount,
    receiverWallet,
    piPayload,
  }
);
    await auditPiPaymentCreated(
  paymentIntentId,
  {
    source: "orders.payment",
    orderId,
    piPaymentId,
    txid,
  },
  client
);

    console.log(
  "[PAYMENT][FINALIZE_INTENT_CALL]"
);

await finalizePaymentIntent(
  client,
  {
    paymentIntentId,
    piPaymentId,
    txid,
  }
);

console.log(
  "[PAYMENT][FINALIZE_INTENT_DONE]"
);
console.log("[STEP] auditPaymentIntentFinalized");
await auditPaymentIntentFinalized(
  paymentIntentId,
  {
    source: "orders.payment",
    orderId,
    piPaymentId,
    txid,
  },
  client
);
console.log("[STEP] auditFinalizeDone");
await auditFinalizeDone(
  paymentIntentId,
  {
    source: "orders.payment",
    orderId,
    piPaymentId,
    txid,
  },
  client
);
    console.log("[STEP] createEscrow");
    const escrowId = await createEscrow(
  client,
  {
    paymentIntentId,
    orderId,
    buyerId: intent.buyer_id,
    sellerId: intent.seller_id,
    amount: verifiedAmount,
    txid,
    piPaymentId,
  }
);
console.log("[STEP] markPiVerified");
await markPiVerified(
  client,
  escrowId
);
console.log("[STEP] markRpcVerified");
await markRpcVerified(
  client,
  paymentIntentId,
  escrowId
);
console.log("[STEP] linkOrder");
    await linkOrder(
  client,
   escrowId,
  orderId
);
    console.log("[STEP] creditSeller");
    const sellerCreditId = await creditSeller(
  client,
  {
    escrowId,
    sellerId: intent.seller_id,
    amount: expectedAmount,
    paymentIntentId,
    orderId,
    piPaymentId,
  }
);
    console.log("[STEP] receiptLink");
    await linkReceiptSettlementByIds({
  paymentIntentId,
  escrowId,
  sellerCreditId,
});
    return {
      ok: true,
      already: false,
      orderId,
      buyerId:
        intent.buyer_id,
      sellerId:
        intent.seller_id,
      amount:
        verifiedAmount,
    };
    });

  try {

    if (
      result.ok &&
      !result.already &&
      result.orderId
    ) {

      await sendNotification({
        userId:
          result.buyerId,

        type:
          "order_created",

        category:
          "order",

        title:
          "Thanh toán thành công",

        message:
          "Đơn hàng của bạn đã được tạo thành công.",

        orderId:
          result.orderId,

        priority:
          "normal",
      });

    }

  } catch (err) {

    console.error(
      "[NOTIFICATION][ORDER_CREATED]",
      err
    );

  }

  return result;

}
}
export async function linkReceiptSettlementByIds(input: {
  paymentIntentId: string;
  escrowId: string;
  sellerCreditId: string;
}): Promise<void> {
  return withTransaction(async (client) => {
    console.log(
      "[PAYMENT][RECEIPT_LINK] START",
      input
    );

    await linkReceiptSettlement(
      client,
      input
    );

    console.log(
      "[PAYMENT][RECEIPT_LINK] DONE",
      input
    );
  });
}
