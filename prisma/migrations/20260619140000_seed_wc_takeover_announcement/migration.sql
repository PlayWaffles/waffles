-- DB-back the World Cup takeover "seen" state (was localStorage). A dedicated,
-- feed-excluded announcement row (kind 'takeover') backs per-user dismissal via
-- AnnouncementState — cross-device + reinstall-proof, mirroring v2-migration-welcome.
-- Idempotent: creates the row if missing, refreshes kind/active on older rows.
INSERT INTO "Announcement" ("id", "slug", "title", "body", "kind", "tone", "emoji", "isActive", "sortOrder")
VALUES
  ('world-cup-takeover', 'world-cup-takeover', 'The World Cup is here',
   'Football trivia live every hour, with real prizes on the line.',
   'takeover', 'leaf', '⚽', true, 0)
ON CONFLICT ("id") DO UPDATE SET
  "kind" = EXCLUDED."kind",
  "isActive" = EXCLUDED."isActive";
