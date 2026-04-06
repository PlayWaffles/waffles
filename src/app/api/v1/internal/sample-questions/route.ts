import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/v1/internal/sample-questions
 *
 * Returns random question templates for the sample tension page.
 * Strips correctIndex so it's not exposed to the client.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const count = Math.min(parseInt(searchParams.get("count") || "5", 10), 10);

  // Fetch random questions using Postgres RANDOM()
  const templates = await prisma.$queryRawUnsafe<
    {
      id: string;
      content: string;
      options: string[];
      durationSec: number;
      mediaUrl: string | null;
      theme: string;
    }[]
  >(
    `SELECT id, content, options, "durationSec", "mediaUrl", theme
     FROM "QuestionTemplate"
     ORDER BY RANDOM()
     LIMIT $1`,
    count
  );

  return NextResponse.json(templates);
}
