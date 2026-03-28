export async function register() {
  // Only run cron jobs on the server (not edge runtime or client)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCronJobs } = await import("@/lib/cron");
    startCronJobs();
  }
}
