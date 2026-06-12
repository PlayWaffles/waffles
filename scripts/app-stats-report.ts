import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path: string) {
  const envPath = resolve(process.cwd(), path);
  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

type StatRow = Record<string, unknown>;

let prisma: Awaited<typeof import("../src/lib/db")>["prisma"];

function percent(numerator: unknown, denominator: unknown) {
  const num = Number(numerator);
  const den = Number(denominator);
  if (!den) return "0.0%";
  return `${((num * 100) / den).toFixed(1)}%`;
}

async function query(sql: string) {
  return prisma.$queryRawUnsafe<StatRow[]>(sql);
}

function print(title: string, data: unknown) {
  console.log(`\n## ${title}`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  loadEnvFile(process.argv[2] ?? ".env.production");
  ({ prisma } = await import("../src/lib/db"));

  const overview = await query(`
    WITH users_by_platform AS (
      SELECT platform,
             COUNT(*)::int users,
             COUNT(*) FILTER (WHERE wallet IS NOT NULL)::int users_with_wallet,
             COUNT(*) FILTER (WHERE "lastLoginAt" >= NOW() - INTERVAL '7 days')::int active_7d,
             COUNT(*) FILTER (WHERE "lastLoginAt" >= NOW() - INTERVAL '30 days')::int active_30d,
             MIN("createdAt") first_signup,
             MAX("createdAt") last_signup
      FROM "User"
      GROUP BY platform
    ), ticket_users AS (
      SELECT u.platform,
             COUNT(DISTINCT e."userId")::int ticket_users,
             COUNT(*)::int ticket_entries,
             COUNT(*) FILTER (WHERE e."purchaseSource" = 'PAID')::int paid_entries,
             COUNT(*) FILTER (WHERE e."purchaseSource" IN ('FREE_ADMIN','FREE_PLAYER'))::int free_entries,
             COUNT(*) FILTER (WHERE e.answered > 0)::int played_entries,
             COUNT(DISTINCT e."userId") FILTER (WHERE e.answered > 0)::int played_users,
             COUNT(DISTINCT e."userId") FILTER (WHERE e."leftAt" IS NOT NULL)::int left_users,
             COALESCE(SUM(e."paidAmount"),0)::float total_paid_amount
      FROM "GameEntry" e
      JOIN "User" u ON u.id = e."userId"
      GROUP BY u.platform
    ), repeat_users AS (
      SELECT platform, COUNT(*)::int repeat_ticket_users
      FROM (
        SELECT u.platform, e."userId", COUNT(*)
        FROM "GameEntry" e
        JOIN "User" u ON u.id = e."userId"
        GROUP BY u.platform, e."userId"
        HAVING COUNT(*) >= 2
      ) x
      GROUP BY platform
    )
    SELECT ubp.*,
           COALESCE(tu.ticket_users,0)::int ticket_users,
           COALESCE(tu.ticket_entries,0)::int ticket_entries,
           COALESCE(tu.paid_entries,0)::int paid_entries,
           COALESCE(tu.free_entries,0)::int free_entries,
           COALESCE(tu.played_users,0)::int played_users,
           COALESCE(tu.played_entries,0)::int played_entries,
           COALESCE(tu.left_users,0)::int left_users,
           COALESCE(ru.repeat_ticket_users,0)::int repeat_ticket_users,
           COALESCE(tu.total_paid_amount,0)::float total_paid_amount
    FROM users_by_platform ubp
    LEFT JOIN ticket_users tu USING (platform)
    LEFT JOIN repeat_users ru USING (platform)
    ORDER BY ubp.platform;
  `);

  print(
    "Overview by platform",
    overview.map((row) => ({
      ...row,
      signup_to_ticket: percent(row.ticket_users, row.users),
      ticket_to_played: percent(row.played_users, row.ticket_users),
      signup_to_played: percent(row.played_users, row.users),
      ticket_repeat_rate: percent(row.repeat_ticket_users, row.ticket_users),
    })),
  );

  print(
    "MiniPay funnel by signup cohort",
    await query(`
      WITH cohorts AS (
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Africa/Lagos')::date cohort_day, id
        FROM "User"
        WHERE platform = 'MINIPAY'
      ), user_flags AS (
        SELECT c.cohort_day, c.id,
               EXISTS (SELECT 1 FROM "GameEntry" e WHERE e."userId" = c.id) has_ticket,
               EXISTS (SELECT 1 FROM "GameEntry" e WHERE e."userId" = c.id AND e.answered > 0) has_played,
               (SELECT COUNT(*) FROM "GameEntry" e WHERE e."userId" = c.id) entry_count
        FROM cohorts c
      )
      SELECT cohort_day::text,
             COUNT(*)::int users,
             COUNT(*) FILTER (WHERE has_ticket)::int ticket_users,
             COUNT(*) FILTER (WHERE has_played)::int played_users,
             COUNT(*) FILTER (WHERE entry_count >= 2)::int repeat_users
      FROM user_flags
      GROUP BY cohort_day
      ORDER BY cohort_day DESC
      LIMIT 30;
    `),
  );

  print(
    "MiniPay hourly behavior Lagos time",
    await query(`
      WITH hours AS (
        SELECT EXTRACT(HOUR FROM u."createdAt" AT TIME ZONE 'Africa/Lagos')::int hr,
               COUNT(*)::int signups,
               0::int tickets,
               0::int played_entries
        FROM "User" u
        WHERE u.platform = 'MINIPAY'
        GROUP BY 1
        UNION ALL
        SELECT EXTRACT(HOUR FROM e."createdAt" AT TIME ZONE 'Africa/Lagos')::int hr,
               0,
               COUNT(*)::int,
               0
        FROM "GameEntry" e
        JOIN "User" u ON u.id = e."userId"
        WHERE u.platform = 'MINIPAY'
        GROUP BY 1
        UNION ALL
        SELECT EXTRACT(HOUR FROM e."updatedAt" AT TIME ZONE 'Africa/Lagos')::int hr,
               0,
               0,
               COUNT(*)::int
        FROM "GameEntry" e
        JOIN "User" u ON u.id = e."userId"
        WHERE u.platform = 'MINIPAY' AND e.answered > 0
        GROUP BY 1
      )
      SELECT hr,
             SUM(signups)::int signups,
             SUM(tickets)::int tickets,
             SUM(played_entries)::int played_entries
      FROM hours
      GROUP BY hr
      ORDER BY hr;
    `),
  );

  print(
    "MiniPay games by start hr Lagos time",
    await query(`
      WITH game_stats AS (
        SELECT g.id,
               EXTRACT(HOUR FROM g."startsAt" AT TIME ZONE 'Africa/Lagos')::int start_hour,
               g."playerCount"::int recorded_players,
               COUNT(e.id)::int entries,
               COUNT(e.id) FILTER (WHERE e.answered > 0)::int played_entries
        FROM "Game" g
        LEFT JOIN "GameEntry" e ON e."gameId" = g.id
        WHERE g.platform = 'MINIPAY'
        GROUP BY g.id
      )
      SELECT start_hour,
             COUNT(*)::int games,
             SUM(recorded_players)::int recorded_players,
             SUM(entries)::int entries,
             SUM(played_entries)::int played_entries,
             ROUND(AVG(recorded_players)::numeric,2)::float avg_recorded_players
      FROM game_stats
      GROUP BY start_hour
      ORDER BY start_hour;
    `),
  );

  print(
    "Recent MiniPay games",
    await query(`
      SELECT g."gameNumber",
             g.title,
             g.theme,
             g.network,
             (g."startsAt" AT TIME ZONE 'Africa/Lagos')::text starts_lagos,
             (g."endsAt" AT TIME ZONE 'Africa/Lagos')::text ends_lagos,
             g."playerCount"::int recorded_players,
             COUNT(e.id)::int entries,
             COUNT(e.id) FILTER (WHERE e.answered > 0)::int played_entries,
             COUNT(e.id) FILTER (WHERE e."purchaseSource" = 'PAID')::int paid_entries,
             COUNT(e.id) FILTER (WHERE e."purchaseSource" IN ('FREE_ADMIN','FREE_PLAYER'))::int free_entries,
             COALESCE(SUM(e."paidAmount"),0)::float paid_amount
      FROM "Game" g
      LEFT JOIN "GameEntry" e ON e."gameId" = g.id
      WHERE g.platform = 'MINIPAY'
      GROUP BY g.id
      ORDER BY g."startsAt" DESC
      LIMIT 20;
    `),
  );

  print(
    "Pending purchases by platform/status",
    await query(`
      SELECT platform,
             status,
             COUNT(*)::int count,
             COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days')::int count_7d,
             MAX("updatedAt")::text last_updated,
             LEFT(MAX("lastError"), 180) last_error_sample
      FROM "PendingPurchase"
      GROUP BY platform, status
      ORDER BY platform, status;
    `),
  );

  print(
    "Question/content inventory",
    await query(`
      SELECT theme,
             COUNT(*)::int templates,
             COUNT(*) FILTER (WHERE "mediaUrl" IS NOT NULL)::int templates_with_media,
             SUM("usageCount")::int total_usage
      FROM "QuestionTemplate"
      GROUP BY theme
      ORDER BY templates DESC;
    `),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
