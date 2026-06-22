export async function register() {
  // Standalone Docker does not always expose NEXT_RUNTIME during startup.
  // The only runtime that must not start Node cron timers is Edge.
  if (process.env.NEXT_RUNTIME !== "edge") {
    const { startCronJobs } = await import("@/lib/cron");
    startCronJobs();
  }
}
