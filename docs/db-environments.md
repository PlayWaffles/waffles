# Database environments

Two Postgres databases share the host `157.180.125.170`, distinguished **only by
port**. They are easy to confuse — always confirm the target before any write.

| Port  | Environment | Chain    | Use for |
|-------|-------------|----------|---------|
| `:55432` | **PRODUCTION** | Celo **mainnet** | The live app + real users. Do **not** point local dev or analysis scripts here. Migrations only as a deliberate, confirmed prod deploy. |
| `:55434` | **STAGING** | Celo **testnet** (`NEXT_PUBLIC_CHAIN_NETWORK=testnet`) | Local dev, analysis scripts, and the `waffles-staging.cyberverse.cloud` deploy. |

`.env`'s `DATABASE_URL` should point at **`:55434` (staging)** for local work
(it currently does, and there's a label above the line). The prod URL lives in
the deploy pipeline, not `.env`.

## Operating rule
- **Never run a migration or any write against `:55432` (prod) without explicit
  confirmation of the environment first.** Reads for analysis should also default
  to staging unless prod data is specifically required and confirmed.
- To run a one-off against a specific DB, pass it explicitly rather than trusting
  `.env`:
  ```bash
  DATABASE_URL="postgresql://…:55434/railway" bunx --bun prisma migrate status
  ```
  and check the printed `Datasource … at 157.180.125.170:555XX` line matches the
  intended environment before proceeding.

## Note (June 2026)
The Rookie Cup migrations (`rookieCupAt` column, `ROOKIE_REWARD` enum, plus a
couple of earlier pending ones) were applied to **both** databases. On prod
(`:55432`) they are additive and backward-compatible — a nullable column the old
code never selects, an enum value the old code never writes, and a column-default
change Prisma overrides client-side — so the live app is unaffected and is simply
pre-expanded for when the Rookie Cup code deploys.
