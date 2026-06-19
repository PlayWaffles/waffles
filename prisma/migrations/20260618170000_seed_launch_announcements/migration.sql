-- Seed the four launch announcements as DB rows (previously hardcoded client-side).
-- Idempotent upsert: creates them if missing, and refreshes tone/emoji/CTA/priority
-- on any older-seeded rows. startsAt/endsAt NULL = always active.
INSERT INTO "Announcement" ("id", "slug", "title", "body", "ctaLabel", "ctaAction", "kind", "tone", "emoji", "isActive", "sortOrder")
VALUES
  ('world-cup-season', 'world-cup-season', 'The World Cup is here',
   'Football trivia, live every hour, with real prizes on the line. See what''s new this season.',
   'See what''s new', 'theme:world-cup', 'info', 'leaf', '⚽', true, 40),
  ('prize-wallet', 'prize-wallet', 'Cash out your winnings',
   'Tournament prizes are paid in USDT. Claim them anytime from your new Prize Wallet.',
   'Open Prize Wallet', 'screen:profile', 'info', 'leaf', '💸', true, 30),
  ('double-xp-weekend', 'double-xp-weekend', 'Double XP weekend',
   'Every tournament you play this weekend earns 2× XP. Climb the leagues faster.',
   'Play now', 'screen:home', 'info', 'berry', '⚡', true, 20),
  ('prize-pool-boost', 'prize-pool-boost', 'Prize pool boosted',
   'Top of the Hour now pays out up to 25 tickets — finish Top 100 to win.',
   NULL, NULL, 'info', 'maple', '🏆', true, 10)
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "ctaLabel" = EXCLUDED."ctaLabel",
  "ctaAction" = EXCLUDED."ctaAction",
  "tone" = EXCLUDED."tone",
  "emoji" = EXCLUDED."emoji",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true;
