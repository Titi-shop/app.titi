import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { reconcilePayment } from "@/lib/services/payment/reconcile.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   CONFIG
========================================================= */

const MAX_BATCH = 5;
const MAX_ATTEMPTS = 5;

/* =========================================================
   TYPES
========================================================= */

type PaymentJob = {
  id: string;
  payment_intent_id: string;
  pi_payment_id: string;
  txid: string;
  attempts: number;
};

/* =========================================================
   FETCH JOBS (LOCKING SAFE)
========================================================= */

async function fetchPendingJobs(): Promise<PaymentJob[]> {
  const sql = `
    SELECT *
    FROM payment_jobs
    WHERE status = 'pending'
      AND run_after <= now()
      AND attempts < $1
    ORDER BY created_at ASC
    LIMIT $2
    FOR UPDATE SKIP LOCKED
  `;

  const result = await query<PaymentJob>(sql, [
    MAX_ATTEMPTS,
    MAX_BATCH,
  ]);

  return result.rows || [];
}

/* =========================================================
   UPDATE JOB STATUS
========================================================= */

async function markJobRunning(jobId: string) {
  await query(
    `
    UPDATE payment_jobs
    SET status = 'running',
        attempts = attempts + 1
    WHERE id = $1
  `,
    [jobId]
  );
}

async function markJobSuccess(jobId: string) {
  await query(
    `
    UPDATE payment_jobs
    SET status = 'success',
        last_error = NULL
    WHERE id = $1
  `,
    [jobId]
  );
}

async function markJobFailed(jobId: string, error: string) {
  await query(
    `
    UPDATE payment_jobs
    SET status = CASE
        WHEN attempts >= $1 THEN 'failed'
        ELSE 'pending'
      END,
      last_error = $2,
      run_after = now() + interval '30 seconds'
    WHERE id = $3
  `,
    [MAX_ATTEMPTS, error, jobId]
  );
}

/* =========================================================
   WORKER ENTRY
========================================================= */

export async function GET() {
  console.log("[WORKER][PAYMENT_JOBS] START");

  try {
    const jobs = await fetchPendingJobs();

    console.log("[WORKER][PAYMENT_JOBS] FETCHED", {
      count: jobs.length,
    });

    if (jobs.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
      });
    }

    let processed = 0;

    for (const job of jobs) {
      console.log("[WORKER][JOB] START", {
        jobId: job.id,
        intent: job.payment_intent_id,
      });

      try {
        await markJobRunning(job.id);

        const result = await reconcilePayment({
          userId: "system", // worker context
          paymentIntentId: job.payment_intent_id,
          piPaymentId: job.pi_payment_id,
          txid: job.txid,
        });

        console.log("[WORKER][JOB] SUCCESS", {
          jobId: job.id,
          orderId: result.order_id,
        });

        await markJobSuccess(job.id);
        processed++;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "UNKNOWN_ERROR";

        console.error("[WORKER][JOB] FAILED", {
          jobId: job.id,
          error: message,
        });

        await markJobFailed(job.id, message);
      }
    }

    console.log("[WORKER][PAYMENT_JOBS] DONE", {
      processed,
    });

    return NextResponse.json({
      success: true,
      processed,
    });
  } catch (err) {
    console.error("[WORKER][PAYMENT_JOBS] CRASH", err);

    return NextResponse.json(
      { error: "WORKER_FAILED" },
      { status: 500 }
    );
  }
}
