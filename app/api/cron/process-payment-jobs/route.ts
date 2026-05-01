import { NextResponse } from "next/server";
import { getPendingJobs, markJobDone } from "@/lib/db/payment.jobs";
import { reconcilePayment } from "@/lib/services/payment/reconcile.service";

export async function GET() {
  console.log("🟡 [WORKER] START");

  const jobs = await getPendingJobs();

  for (const job of jobs) {
    try {
      console.log("🟡 [WORKER] PROCESS_JOB", job.id);

      await reconcilePayment({
        userId: job.user_id,
        paymentIntentId: job.payment_intent_id,
        piPaymentId: job.pi_payment_id,
        txid: job.txid,
      });

      await markJobDone(job.id);

      console.log("🟢 [WORKER] DONE", job.id);
    } catch (err) {
      console.error("🔥 [WORKER] FAIL", job.id, err);
    }
  }

  return NextResponse.json({
    success: true,
    processed: jobs.length,
  });
}
