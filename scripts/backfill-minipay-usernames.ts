import { prisma } from "@/lib/db";
import { UserPlatform } from "@prisma";
import { generateUniqueMiniPayUsername } from "@/lib/usernames";

const isDryRun = process.argv.includes("--dry-run");
const isVerbose = process.argv.includes("--verbose");
const TIMEOUT_MS = Number(process.env.BACKFILL_TIMEOUT_MS ?? 120_000);
const BATCH_SIZE = 25;

async function main() {
  const [users, existingNamedUsers] = await Promise.all([
    prisma.user.findMany({
      where: {
        platform: UserPlatform.MINIPAY,
        OR: [{ username: null }, { username: "" }],
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        wallet: true,
      },
    }),
    prisma.user.findMany({
      where: {
        platform: UserPlatform.MINIPAY,
        username: { not: null },
      },
      select: {
        username: true,
      },
    }),
  ]);

  const assignedUsernames = new Set(
    existingNamedUsers
      .map((user) => user.username?.trim().toLowerCase())
      .filter((username): username is string => Boolean(username)),
  );

  const updates: Array<{ id: string; username: string }> = [];

  for (const user of users) {
    const seed = user.wallet ?? user.id;
    const username = await generateUniqueMiniPayUsername(seed, async (candidate) =>
      assignedUsernames.has(candidate.toLowerCase()),
    );

    assignedUsernames.add(username.toLowerCase());
    updates.push({ id: user.id, username });
  }

  if (!isDryRun) {
    for (let index = 0; index < updates.length; index += BATCH_SIZE) {
      const batch = updates.slice(index, index + BATCH_SIZE);

      await Promise.all(
        batch.map((update) =>
          prisma.user.update({
            where: { id: update.id },
            data: { username: update.username },
          }),
        ),
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun: isDryRun,
        matchedUsers: users.length,
        updatedUsers: isDryRun ? 0 : updates.length,
        existingNamedUsers: existingNamedUsers.length,
        sampleUsernames: updates.slice(0, 20),
        ...(isVerbose ? { usernames: updates } : {}),
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
