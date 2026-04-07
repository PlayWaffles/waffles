DROP INDEX IF EXISTS "Game_gameNumber_key";

CREATE UNIQUE INDEX "Game_network_gameNumber_key" ON "Game"("network", "gameNumber");
