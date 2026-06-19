-- Carry the authoring category (topic) onto per-game questions so the play UI
-- can show the subject in the pill instead of the format. Nullable + additive:
-- questions created before this column fall back to the game's theme label.
ALTER TABLE "Question" ADD COLUMN "category" VARCHAR(40);
