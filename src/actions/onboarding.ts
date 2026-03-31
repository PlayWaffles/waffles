"use server";

import { prisma } from "@/lib/db";

export interface DemoQuestion {
  content: string;
  mediaUrl: string | null;
  options: string[];
  correctIndex: number;
}

const DEMO_QUESTION_TEMPLATE_ID = "cmkct276000030lqj9jbd0c8d";

/**
 * Fetches the fixed question template used for the onboarding demo.
 */
export async function getDemoQuestion(): Promise<DemoQuestion | null> {
  const template = await prisma.questionTemplate.findUnique({
    where: { id: DEMO_QUESTION_TEMPLATE_ID },
    select: {
      content: true,
      mediaUrl: true,
      options: true,
      correctIndex: true,
    },
  });

  if (!template) return null;

  return {
    content: template.content,
    mediaUrl: template.mediaUrl,
    options: template.options,
    correctIndex: template.correctIndex,
  };
}
