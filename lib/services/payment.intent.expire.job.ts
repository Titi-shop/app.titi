import { withTransaction } from "@/lib/db";
import {
  releaseReservedStock,
} from "@/lib/db/payments.intent";

export async function processExpiredPaymentIntentJob() {
  return withTransaction(async (client) => {

    // Bước tiếp theo sẽ viết ở đây

    return {
      success: true,
      processed: 0,
    };
  });
}
