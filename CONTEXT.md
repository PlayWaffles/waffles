# Waffles Domain Glossary

## Tournament

A 4-hour on-chain trivia round. Players buy tickets (USDC), answer multi-format questions, and winners split the prize pool via merkle settlement.

## Game

The database record for a tournament round (`startsAt` / `endsAt` define phase). One flat entry fee per game, enforced on-chain.

## Ticket Settlement

Verifying an on-chain `buyTicket` and recording a paid `GameEntry` + prize pool increment. Tournament entry flows through `recordPaidEntry()` with `tournamentEntryHooks` in `src/lib/game/ticket-settlement-adapters.ts`.

## GameEntry

A player's participation record: `txHash`, `payerWallet`, `paidAmount`, `score`, `bonusScore` (skill-edge head start), `answers` JSON.

## Game Timing Authority

`src/lib/game/timing.ts` — phase derivation and guards (`canAnswer`, `canPurchaseTicket`, `canClaim`). Ticket sales close 5 min before `endsAt`; claims open 1 hour after `endsAt`.

## Settlement

`src/lib/game/settlement.ts` — rank → publish merkle root → notify. `settleGame()` is the cron/admin entry point.

## Syrup

Off-chain reward currency (ticket ledger), separate from USDC prizes.