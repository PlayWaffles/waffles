#!/usr/bin/env bash
#
# Repeatable v1 → production data sync + v2 baseline.
#
# Refreshes a v2 PRODUCTION database with the current contents of the live v1
# Railway database, then brings it to the v2 schema. Use this for a cutover
# re-sync (live v1 keeps taking users; this catches them up).
#
# WHY NOT `prisma migrate deploy`?  The committed v2 migrations were generated
# against a dev baseline that has DRIFTED from the real v1 schema (extra enums,
# columns, indexes), so replaying them on real v1 fails ("type/column already
# exists", "index does not exist"). Instead we compute the REAL v1→v2 delta with
# `prisma migrate diff` and apply that, then baseline `_prisma_migrations`. This
# is drift-proof and is the method validated against live production.
#
# Usage:
#   SOURCE_URL="postgresql://…live-v1-railway…" \
#   TARGET_URL="postgresql://…v2-production…" \
#   APP_ENV_FILE=.env \                # env file with app vars (DATABASE_URL is overridden)
#   ./scripts/migration/sync-v1-to-production.sh
#
# Safety: backs up TARGET first; SOURCE is only ever read. Only intentional data
# loss is DROP TABLE "Chat" (preserved in both the target backup and source dump).
set -euo pipefail

: "${SOURCE_URL:?Set SOURCE_URL to the live v1 connection string (read-only source)}"
: "${TARGET_URL:?Set TARGET_URL to the v2 production connection string (overwritten)}"
APP_ENV_FILE="${APP_ENV_FILE:-.env}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"
PRISMA="./node_modules/prisma/build/index.js"

STAMP="$(date +%Y%m%d_%H%M%S)"
DIR="${BACKUP_DIR:-$HOME/waffles-migration-${STAMP}}"
mkdir -p "$DIR"
src_host() { printf '%s' "$1" | sed -E 's#.*@([^/?]+).*#\1#'; }

echo "SOURCE (read):  $(src_host "$SOURCE_URL")"
echo "TARGET (write): $(src_host "$TARGET_URL")"
read -r -p "This OVERWRITES the target with the source, then baselines to v2. Type 'sync' to continue: " ok
[ "$ok" = "sync" ] || { echo "Aborted."; exit 1; }

echo "==> 1/8  Backing up TARGET to $DIR/target_backup.dump ..."
pg_dump --format=custom --no-owner --no-privileges -f "$DIR/target_backup.dump" "$TARGET_URL"

echo "==> 2/8  Dumping SOURCE (live v1, read-only) ..."
pg_dump --format=custom --no-owner --no-privileges -f "$DIR/source_v1.dump" "$SOURCE_URL"

echo "==> 3/8  Restoring source → target (--clean) ..."
pg_restore --clean --if-exists --no-owner --no-privileges --no-acl -d "$TARGET_URL" "$DIR/source_v1.dump" || true

echo "==> 4/8  Computing real v1→v2 delta ..."
DATABASE_URL="$TARGET_URL" node "$PRISMA" migrate diff \
  --from-config-datasource --to-schema prisma/schema.prisma --script > "$DIR/v1_to_v2_delta.sql"

echo "==> 5/8  Applying delta (single transaction) ..."
psql "$TARGET_URL" --single-transaction -v ON_ERROR_STOP=1 -f "$DIR/v1_to_v2_delta.sql" >/dev/null

echo "==> 6/8  Baselining _prisma_migrations (mark all pending applied) ..."
# Clear any stray failed/rolled-back rows, then mark every not-yet-applied migration as applied.
psql "$TARGET_URL" -c "DELETE FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;" >/dev/null
DATABASE_URL="$TARGET_URL" node "$PRISMA" migrate status 2>/dev/null \
  | grep -E '^[0-9]{14}_' | tr -d ' ' \
  | while read -r m; do
      [ -z "$m" ] && continue
      DATABASE_URL="$TARGET_URL" node "$PRISMA" migrate resolve --applied "$m" >/dev/null 2>&1 \
        && echo "    applied: $m"
    done
# Re-run data-only seed migrations whose INSERTs the baseline skipped (idempotent).
for m in 20260618170000_seed_launch_announcements 20260619140000_seed_wc_takeover_announcement; do
  [ -f "prisma/migrations/$m/migration.sql" ] && psql "$TARGET_URL" -f "prisma/migrations/$m/migration.sql" >/dev/null 2>&1 || true
done

echo "==> 7/8  Reseeding v2 content + XP backfill ..."
SEED_ENV="$(mktemp)"
grep -v '^DATABASE_URL=' "$APP_ENV_FILE" > "$SEED_ENV"
echo "DATABASE_URL=\"$TARGET_URL\"" >> "$SEED_ENV"
# delete-safe order: questions clears the bank, content adds multi-format, wc-formats last
for s in seed-v2-shop seed-v2-missions-leagues seed-v2-partner-offers seed-v2-questions seed-v2-content seed-wc-formats; do
  echo "    seed: $s"
  node --env-file="$SEED_ENV" --import tsx "scripts/$s.ts" >/dev/null 2>&1 || echo "      (warning: $s had non-zero exit)"
done
rm -f "$SEED_ENV"
# XP backfill: migrated players' XP from their game history (mirrors v2 score→XP).
psql "$TARGET_URL" -c "UPDATE \"User\" u SET xp = COALESCE((SELECT SUM(ge.score) FROM \"GameEntry\" ge WHERE ge.\"userId\" = u.id), 0);" >/dev/null

echo "==> 8/8  Verify ..."
DATABASE_URL="$TARGET_URL" node "$PRISMA" migrate status 2>&1 | grep -iE "up to date|not yet|failed" || true
psql "$TARGET_URL" -tAc "SELECT
  (SELECT count(*) FROM \"User\") users,
  (SELECT count(*) FROM \"User\" WHERE xp>0) with_xp,
  (SELECT count(*) FROM \"GameEntry\") scores,
  (SELECT count(*) FROM \"QuestionTemplate\") templates,
  (SELECT count(*) FROM \"ShopItem\") shop;"

echo
echo "Done. Backups in: $DIR"
echo "Rollback target:  pg_restore --clean --no-owner -d \"\$TARGET_URL\" $DIR/target_backup.dump"
