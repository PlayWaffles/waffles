WITH prelaunch AS (
  SELECT
    id,
    row_number() OVER (ORDER BY "startsAt", "createdAt", id) AS next_number
  FROM "Game"
  WHERE platform = 'MINIPAY'
    AND network = 'CELO_MAINNET'
    AND "startsAt" < TIMESTAMPTZ '2026-06-03T14:00:00.000Z'
)
UPDATE "Game" AS game
SET
  "gameNumber" = prelaunch.next_number + 1000000,
  title = 'Waffles #' || (prelaunch.next_number + 1000000)::text
FROM prelaunch
WHERE game.id = prelaunch.id;

WITH launch AS (
  SELECT
    id,
    row_number() OVER (ORDER BY "startsAt", "createdAt", id) AS next_number
  FROM "Game"
  WHERE platform = 'MINIPAY'
    AND network = 'CELO_MAINNET'
    AND "startsAt" >= TIMESTAMPTZ '2026-06-03T14:00:00.000Z'
)
UPDATE "Game" AS game
SET
  "gameNumber" = launch.next_number,
  title = 'Waffles #' || lpad(launch.next_number::text, 3, '0')
FROM launch
WHERE game.id = launch.id;
