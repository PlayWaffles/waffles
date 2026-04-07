import { isLocalDevelopmentDeployment } from "@/lib/deployment";

export function shouldSkipNotifications() {
  return isLocalDevelopmentDeployment();
}
