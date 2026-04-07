import { prisma } from "../src/lib/db";

async function main() {
  const usageCounts = await prisma.question.groupBy({
    by: ["templateId"],
    where: {
      templateId: { not: null },
      game: {
        isTestnet: false,
      },
    },
    _count: {
      templateId: true,
    },
  });

  await prisma.questionTemplate.updateMany({
    data: { usageCount: 0 },
  });

  for (const row of usageCounts) {
    if (typeof row.templateId !== "string") continue;

    await prisma.questionTemplate.update({
      where: { id: row.templateId },
      data: { usageCount: row._count.templateId },
    });
  }

  console.log(
    JSON.stringify(
      {
        updatedTemplates: usageCounts.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(
      "[recalculate-question-template-usage]",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
