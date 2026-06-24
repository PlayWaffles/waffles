-- Skill-edge: a starting score cushion granted at tournament entry, scaled by
-- World Cup campaign depth. Folded into GameEntry.score for ranking; bonusScore
-- is retained for transparency + so re-submits recompute score = round + bonus.
ALTER TABLE "GameEntry" ADD COLUMN "bonusScore" SMALLINT NOT NULL DEFAULT 0;
