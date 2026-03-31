"use server";

import { prisma } from "@/lib/db";

export interface DemoQuestion {
  content: string;
  mediaUrl: string | null;
  options: string[];
  correctIndex: number;
}

/**
 * Fetches a random question template from the bank for the onboarding demo.
 * Prefers questions with media for a more engaging experience.
 */
export async function getDemoQuestion(): Promise<DemoQuestion | null> {
  // Try to find a question with media first for visual appeal
  let template = await prisma.questionTemplate.findFirst({
    where: { mediaUrl: { not: null } },
    select: {
      content: true,
      mediaUrl: true,
      options: true,
      correctIndex: true,
    },
    orderBy: { usageCount: "asc" },
    skip: Math.floor(
      Math.random() *
        (await prisma.questionTemplate.count({
          where: { mediaUrl: { not: null } },
        })),
    ),
  });

  // Fall back to any question if none have media
  if (!template) {
    template = await prisma.questionTemplate.findFirst({
      select: {
        content: true,
        mediaUrl: true,
        options: true,
        correctIndex: true,
      },
      orderBy: { usageCount: "asc" },
      skip: Math.floor(
        Math.random() * (await prisma.questionTemplate.count()),
      ),
    });
  }

  if (!template) return null;

  return {
    content: template.content,
    mediaUrl: template.mediaUrl,
    options: template.options,
    correctIndex: template.correctIndex,
  };
}
