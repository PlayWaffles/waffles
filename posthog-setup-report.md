<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into the Waffles project. PostHog is initialized client-side via `instrumentation-client.ts` (the recommended approach for Next.js 15.3+), a server-side singleton client was added in `src/lib/posthog-server.ts`, and PostHog ingest rewrites were added to `next.config.ts` to proxy events through the app for ad-blocker resilience. Users are identified in `AppInitializer` as soon as their data loads, linking all client and server events to the same person. Eight business-critical events were instrumented across four client-side and four server-side files, covering the full player journey from invite redemption through ticket purchase, live gameplay, and game completion.

| Event | Description | File |
|---|---|---|
| `invite_code_redeemed` | User successfully redeems an invite code to gain game access | `src/app/(app)/redeem/client.tsx` |
| `invite_code_failed` | User attempted to redeem an invite code but it was invalid or failed | `src/app/(app)/redeem/client.tsx` |
| `ticket_shared` | User shares their ticket after a successful purchase | `src/app/(app)/(game)/game/[gameId]/ticket/success/client.tsx` |
| `game_left` | User confirms leaving a live game (rage quit) | `src/app/(app)/(game)/game/_components/LeaveGameDrawer.tsx` |
| `invite_friends_opened` | User opens the invite friends drawer from the profile page | `src/app/(app)/(game)/profile/page.tsx` |
| `ticket_purchase_completed` | A paid on-chain ticket purchase is successfully finalized | `src/lib/game/purchase.ts` |
| `free_ticket_claimed` | User successfully claims a free ticket for a game | `src/actions/game.ts` |
| `game_completed` | A game is completed, entries ranked, and prizes distributed | `src/app/api/v1/internal/games/[gameId]/roundup/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://eu.posthog.com/project/154647/dashboard/607274
- **Invite-to-Ticket Conversion Funnel**: https://eu.posthog.com/project/154647/insights/dSzXgMMf
- **Ticket Purchases Over Time**: https://eu.posthog.com/project/154647/insights/IPdoi5iq
- **Game Churn (Rage Quits) Over Time**: https://eu.posthog.com/project/154647/insights/YgsTc7JD
- **Invite Code Success vs Failure**: https://eu.posthog.com/project/154647/insights/47rmVwsk
- **Games Completed & Winners**: https://eu.posthog.com/project/154647/insights/U8q8RwJ2

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
