import { NextRequest } from "next/server";
import { runRoundupCronRequest } from "@/lib/game/roundup-route";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runRoundupCronRequest(request);
}

export async function POST(request: NextRequest) {
  return runRoundupCronRequest(request);
}
