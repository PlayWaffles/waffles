import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Farcaster manifest removed in MiniPay build" },
    { status: 410 },
  );
}
