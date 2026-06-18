#!/usr/bin/env bash
#
# v1 → v2 production database migration.
#
# The v1 DB's migration history is a clean PREFIX of this repo's history
# (applied through 20260613133500_add_onboarding_completion), so we do NOT need
# a manual baseline / `migrate resolve`. A plain `prisma migrate deploy` applies
# exactly the 7 pending v2 migrations in order:
#
#   20260614223726_v2_progression_economy        (Syrup/lives/xp, LevelProgress, …)
#   20260615061321_v2_partner_offers_season_pass
#   20260617052902_add_question_template_category
#   20260617120000_add_analytics_events
#   20260618120000_v2_league_cohorts
#   20260618130000_league_reward_ticket_reason
#   20260618140000_remove_chat                    (DROPS Chat — destructive)
#
# All 7 are safe on the 15,536 existing users (every added column is nullable or
# has a default; no NOT-NULL-without-default; no unique index on a populated
# table). The ONLY data loss is the intentional `DROP TABLE "Chat"` (≈181 rows),
# which the full pg_dump backup below preserves.
#
# Existing users receive the v2 defaults: ticketBalance=3 (Syrup, off-chain soft
# currency — NOT USDC tickets), lives=5, xp=0. This matches the new-user grant.
#
# Usage:
#   DATABASE_URL="postgresql://…/railway" ./scripts/migration/run-v1-to-v2.sh
#
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to the v1 production connection string}"
export DATABASE_URL

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP="db_backup_v1_pre_v2_${STAMP}.dump"

echo "Target DB host: $(printf '%s' "$DATABASE_URL" | sed -E 's#.*@([^/?]+).*#\1#')"
read -r -p "This will migrate the above database to v2 (incl. DROP Chat). Type 'migrate' to continue: " ok
[ "$ok" = "migrate" ] || { echo "Aborted."; exit 1; }

echo "==> 1/4  Backing up full database to ${BACKUP} (preserves Chat) …"
pg_dump --format=custom --no-owner --no-privileges --file "${BACKUP}" "${DATABASE_URL}"
echo "    Backup written: ${BACKUP} ($(du -h "${BACKUP}" | cut -f1))"

echo "==> 2/4  Pending migrations:"
pnpm prisma migrate status || true

echo "==> 3/4  Applying migrations (prisma migrate deploy) …"
pnpm prisma migrate deploy

echo "==> 4/4  Re-seeding the shop catalog (ShopItem is created empty) …"
echo "    NOTE: run in an env with the full app env vars. Example:"
echo "      DATABASE_URL=\"\$DATABASE_URL\" node --env-file=.env.production --import tsx scripts/seed-v2-shop.ts"

echo
echo "Done. Verify with:  pnpm prisma migrate status"
echo "Rollback (if needed):  pg_restore --clean --no-owner -d \"\$DATABASE_URL\" ${BACKUP}"
