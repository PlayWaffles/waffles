import { prisma } from "@/lib/db";
import { UserPlatform } from "@prisma";
import { generateUniqueMiniPayUsername } from "@/lib/usernames";

const isDryRun = process.argv.includes("--dry-run");
const TIMEOUT_MS = 15_000;

async function main() {
  const users = await prisma.user.findMany({
    where: {
      platform: UserPlatform.MINIPAY,
      OR: [{ username: null }, { username: "" }],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      wallet: true,
    },
  });

  const updates: Array<{ id: string; username: string }> = [];

  for (const user of users) {
    const seed = user.wallet ?? user.id;
    const username = await generateUniqueMiniPayUsername(seed, (candidate) =>
      prisma.user
        .findFirst({
          where: {
            id: { not: user.id },
            platform: UserPlatform.MINIPAY,
            username: { equals: candidate, mode: "insensitive" },
          },
          select: { id: true },
        })
        .then(Boolean),
    );

    updates.push({ id: user.id, username });

    if (!isDryRun) {
      await prisma.user.update({
        where: { id: user.id },
        data: { username },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun: isDryRun,
        matchedUsers: users.length,
        updatedUsers: isDryRun ? 0 : updates.length,
        usernames: updates,
      },
      null,
      2,
    ),
  );
}

const timeout = setTimeout(() => {
  console.error(
    `[backfill-minipay-usernames] Timed out after ${TIMEOUT_MS}ms while waiting for the database`,
  );
  process.exit(1);
}, TIMEOUT_MS);

main()
  .catch((error) => {
    console.error(
      "[backfill-minipay-usernames]",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    clearTimeout(timeout);
    await prisma.$disconnect();
  });
