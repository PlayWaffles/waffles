WITH numbered AS (
  SELECT
    id,
    row_number() OVER (ORDER BY "startsAt", "createdAt", id) AS next_number
  FROM "Game"
  WHERE platform = 'MINIPAY'
    AND network = 'CELO_MAINNET'
)
UPDATE "Game" AS game
SET "gameNumber" = numbered.next_number + 1000000
FROM numbered
WHERE game.id = numbered.id;

WITH renumbered AS (
  SELECT
    id,
    row_number() OVER (ORDER BY "startsAt", "createdAt", id) AS next_number
  FROM "Game"
  WHERE platform = 'MINIPAY'
    AND network = 'CELO_MAINNET'
)
UPDATE "Game" AS game
SET
  "gameNumber" = renumbered.next_number,
  title = 'Waffles #' || lpad(renumbered.next_number::text, 3, '0')
FROM renumbered
WHERE game.id = renumbered.id;
