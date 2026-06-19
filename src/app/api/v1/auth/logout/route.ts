import { NextResponse } from "next/server";

import { clearAuthCookies } from "@/lib/auth";
import { trackServerEvent } from "@/lib/server-analytics";

export async function POST() {
  await clearAuthCookies();
  await trackServerEvent({
    name: "api_auth_logout_succeeded",
    properties: {
      result: "cleared",
    },
  });
  return NextResponse.json({ success: true });
}
