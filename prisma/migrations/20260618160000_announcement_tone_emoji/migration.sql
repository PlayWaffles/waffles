-- Add display fields the in-app banner/inbox render (previously client-only).
ALTER TABLE "Announcement" ADD COLUMN "tone" VARCHAR(12) NOT NULL DEFAULT 'leaf';
ALTER TABLE "Announcement" ADD COLUMN "emoji" VARCHAR(8) NOT NULL DEFAULT '📣';
