// =====================================================
// lib/services/payment.intent.expire.job.ts
// =====================================================

import {
  withTransaction,
} from "@/lib/db";

import {
  findExpiredPaymentIntents,
  expirePaymentIntentFlow,
} from "@/lib/db/payments.intent";

export async function processPaymentIntentExpireJob() {

  console.log(
    "[PAYMENT_INTENT_JOB] START"
  );

  try {

    return await withTransaction(
      async (client) => {

        console.log(
          "[PAYMENT_INTENT_JOB] TX_BEGIN"
        );

        /* =============================================
           FIND EXPIRED PAYMENT INTENTS
        ============================================= */

        const intents =
          await findExpiredPaymentIntents(
            client
          );

        console.log(
          "[PAYMENT_INTENT_JOB] FOUND",
          {
            total:
              intents.length,
          }
        );

        if (
          !intents.length
        ) {

          console.log(
            "[PAYMENT_INTENT_JOB] NOTHING_TO_PROCESS"
          );

          return {
            success: true,
            processed: 0,
          };
        }

        /* =============================================
           PROCESS LOOP
        ============================================= */

        for (const intent of intents) {

          console.log(
            "[PAYMENT_INTENT_JOB] PROCESS_START",
            {
              paymentIntentId:
                intent.id,
            }
          );

          try {

            await expirePaymentIntentFlow({
              client,
              intent,
            });

            console.log(
              "[PAYMENT_INTENT_JOB] PROCESS_SUCCESS",
              {
                paymentIntentId:
                  intent.id,
              }
            );

          } catch (error) {

            console.error(
              "[PAYMENT_INTENT_JOB] PROCESS_FAILED",
              {
                paymentIntentId:
                  intent.id,
                error,
              }
            );

            throw error;
          }
        }

        console.log(
          "[PAYMENT_INTENT_JOB] COMPLETE",
          {
            processed:
              intents.length,
          }
        );

        return {
          success: true,
          processed:
            intents.length,
        };
      }
    );

  } catch (error) {

    console.error(
      "[PAYMENT_INTENT_JOB] FATAL",
      error
    );

    throw error;
  }
}
