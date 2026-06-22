-- Lower the default entry cap for new games from 200 to 100 spots.
-- Non-destructive: only changes the column default; existing rows are untouched.
ALTER TABLE "Game" ALTER COLUMN "maxPlayers" SET DEFAULT 100;
