import { processPaymentJobs } from "@/lib/workers/payment.processor";

async function startWorker() {
  console.log("[WORKER] PAYMENT STARTED");

  setInterval(async () => {
    await processPaymentJobs();
  }, 3000);
}

startWorker();
