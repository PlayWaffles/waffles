import { env } from "@/lib/env";

export function shouldSkipNotifications() {
  return process.env.NODE_ENV !== "production" && env.rootUrl.includes("localhost");
}
