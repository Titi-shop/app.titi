import { reconcilePayment } from "@/lib/services/payment/reconcile.service";
import { getPendingJobs } from "@/lib/db/payment.jobs";

export async function POST() {
  const jobs = await getPendingJobs();

  for (const job of jobs) {
    try {
      await reconcilePayment(job);

      await markJobDone(job.id);
    } catch (e) {
      await markJobFailed(job.id);
    }
  }

  return Response.json({ ok: true });
}
