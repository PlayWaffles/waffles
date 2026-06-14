// Authenticated mount of the ported v2 app. Same self-contained SPA as the
// `/v2` preview, but here under the (app) auth runtime so `loadV2State()`
// resolves the real signed-in user and the wired economy runs against live data.
// This is the cutover target for the player experience.
export { default } from "@/app/v2/_app/page";
