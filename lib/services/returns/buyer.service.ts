import {
  getReturnsByBuyer,
  getReturnByIdForBuyer,
  createReturn,
  cancelReturnByBuyer,
  shipReturnByBuyer,
} from "@/lib/db/returns";

/* =====================================================
   TYPES
===================================================== */

export type CreateReturnBody = {
  orderId?: string;
  orderItemId?: string;
  reason?: string;
  description?: string;
  images?: string[];
};

type UpdateReturnBody = {
  action: "cancel" | "ship";
  tracking_code?: string;
  shipping_provider?: string;
};

/* =====================================================
   HELPERS
===================================================== */

function isValidUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

function isValidImageUrl(url: string): boolean {
  return (
    url.startsWith("http") &&
    url.includes("/storage/v1/object/public/")
  );
}

/* =====================================================
   QUERY
===================================================== */

export async function listBuyerReturns(
  buyerId: string
) {
  return getReturnsByBuyer(
    buyerId
  );
}

export async function getReturnDetail(
  buyerId: string,
  returnId: string
) {
  return getReturnByIdForBuyer(
    returnId,
    buyerId
  );
}

/* =====================================================
   CREATE RETURN
===================================================== */

export async function createBuyerReturn(
  buyerId: string,
  body: CreateReturnBody
) {
  const orderId =
    body.orderId?.trim() ?? "";

  const orderItemId =
    body.orderItemId?.trim() ?? "";

  const reason =
    body.reason?.trim() ?? "";

  const description =
    body.description?.trim() ?? "";

  if (
    !orderId ||
    !orderItemId ||
    !reason
  ) {
    throw new Error(
      "INVALID_INPUT"
    );
  }

  if (
    !isValidUuid(orderId) ||
    !isValidUuid(orderItemId)
  ) {
    throw new Error(
      "INVALID_UUID"
    );
  }

  if (
    reason.length > 200
  ) {
    throw new Error(
      "INVALID_REASON"
    );
  }

  if (
    description.length > 2000
  ) {
    throw new Error(
      "INVALID_DESCRIPTION"
    );
  }

  const images =
    Array.isArray(body.images)
      ? body.images
          .filter(
            (
              value
            ): value is string =>
              typeof value ===
                "string" &&
              value.trim()
                .length > 0 &&
              !value.includes(
                "undefined"
              ) &&
              isValidImageUrl(
                value
              )
          )
          .slice(0, 5)
      : [];

  return createReturn(
    buyerId,
    orderId,
    orderItemId,
    reason,
    description,
    images
  );
}

/* =====================================================
   UPDATE RETURN
===================================================== */

export async function updateReturnStatus(
  buyerId: string,
  returnId: string,
  body: UpdateReturnBody
) {
  switch (
    body.action
  ) {
    case "cancel":
      return cancelReturnByBuyer(
        returnId,
        buyerId
      );

    case "ship":
      if (
        !body.tracking_code?.trim()
      ) {
        throw new Error(
          "TRACKING_REQUIRED"
        );
      }

      return shipReturnByBuyer({
        returnId,
        buyerId,
        trackingCode:
          body.tracking_code.trim(),
        shippingProvider:
          body.shipping_provider?.trim() ??
          null,
      });

    default:
      throw new Error(
        "INVALID_ACTION"
      );
  }
}
