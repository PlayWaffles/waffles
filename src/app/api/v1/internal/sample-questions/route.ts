import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/v1/internal/sample-questions
 *
 * Returns random question templates for the sample tension page.
 * Strips correctIndex so it's not exposed to the client.
 */
export async function GET() {
  // Fetch 5 random questions from the most-used pool (top 50 by usageCount)
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
     FROM (
       SELECT * FROM "QuestionTemplate"
       ORDER BY "usageCount" DESC
       LIMIT 50
     ) AS top
     ORDER BY RANDOM()
     LIMIT 5`
  );

  return NextResponse.json(templates);
}
