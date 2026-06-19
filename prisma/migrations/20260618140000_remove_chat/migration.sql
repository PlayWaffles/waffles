-- Drop the v1 live-chat table (async v2 has no live chat).
-- FK constraints on Chat (gameId → Game, userId → User) are dropped with the table.
DROP TABLE "Chat";
