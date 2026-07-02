import {
  getReturnsBySeller,
  getReturnByIdForSeller,
  approveReturnBySeller,
  rejectReturnBySeller,
  markReturnReceivedBySeller,
} from "@/lib/db/returns";

import type { ReturnStatus } from "@/lib/db/returns/seller.types";

/* =====================================================
   QUERIES
===================================================== */

export async function listSellerReturns(
  sellerId: string,
  status?: ReturnStatus | null
) {
  return getReturnsBySeller(
    sellerId,
    status ?? null
  );
}

export async function getSellerReturn(
  sellerId: string,
  returnId: string
) {
  return getReturnByIdForSeller(
    returnId,
    sellerId
  );
}

/* =====================================================
   COMMANDS
===================================================== */

export async function approveSellerReturn(
  sellerId: string,
  returnId: string
) {
  return approveReturnBySeller(
    returnId,
    sellerId
  );
}

export async function rejectSellerReturn(
  sellerId: string,
  returnId: string
) {
  return rejectReturnBySeller(
    returnId,
    sellerId
  );
}

export async function receiveSellerReturn(
  sellerId: string,
  returnId: string
) {
  return markReturnReceivedBySeller(
    returnId,
    sellerId
  );
}
