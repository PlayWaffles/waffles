# Waffles v2 Analytics Instrumentation Map

Audit date: 2026-06-17  
Repo: `/Users/thecyberverse/Code/waffles-celo`  
Branch audited: `waffles-v2-migration`  
Scope: v2 app shell, v2 gameplay/economy services, route inventory, provider/hooks, share/notification/cron/API surfaces.

## Executive Summary

Waffles v2 is a mobile-first trivia game with four major loops:

- Activation: first app open, World Cup takeover, onboarding, wallet sign-in, username setup, first level.
- Solo progression: level path, lives, question answers, level win/fail, XP, milestones, badges.
- Live tournament: hourly entry, lobby, timed questions, score submit, settlement, result notification, prize wallet.
- Economy/retention: daily reward, missions, partner offers, season pass, leagues, shop, tickets, powerups, cosmetics.

Current analytics coverage is thin. `src/lib/analytics.ts` defines a useful Umami client helper and a few event names, but `src/components/providers/AppInitializer.tsx` only sends `app_opened`. Most v2 interactions, server outcomes, and economy changes are not tracked.

Instrumentation should track both client intent and authoritative server result. Client events tell us what the player tried; server events tell us what actually happened.

## Current Analytics Baseline

Existing helper:

- `src/lib/analytics.ts`
- Client call: `trackClientEvent(event, data)`
- Transport: `window.umami.track(event, data)`
- Existing attribution capture: `captureFirstTouchAttribution()`
- Existing first-touch keys: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `ref`, `referrer`, `landing_page`

Currently observed usage:

- `src/components/providers/AppInitializer.tsx`
  - Sends `app_opened`
  - Properties: `runtime`, `path`, first-touch attribution

Defined event enum values that are not broadly wired into v2:

- App/auth/onboarding: `page_viewed`, `app_opened`, `auth_started`, `auth_completed`, `auth_failed`, `onboarding_started`, `onboarding_completed`, `onboarding_failed`
- Legacy ticket/referral/game events: `game_seen`, `ticket_cta_clicked`, `ticket_purchase_blocked`, `ticket_purchase_started`, `ticket_approval_submitted`, `ticket_approval_confirmed`, `ticket_purchase_tx_submitted`, `ticket_purchase_tx_confirmed`, `ticket_purchase_sync_started`, `ticket_purchase_sync_succeeded`, `ticket_purchase_sync_failed`, `referral_redeemed`

## Privacy Rules

Do not send raw wallet addresses, signatures, transaction hashes, emails, support messages, or payment identifiers to Umami.

Use these instead:

- `user_id_hash`
- `wallet_connected: true`
- `tx_present: true`
- `chain_id`
- `amount_usdt`
- `ticket_delta`
- `result`
- `reason`
- `ref_type`
- `ref_id_kind`

## Common Event Properties

Send these on every client event where available:

- `screen`
- `source_screen`
- `path`
- `runtime`
- `is_authenticated`
- `wallet_connected`
- `user_id_hash`
- `session_id`
- `theme_id`
- `season`
- `league`
- `tickets_balance`
- `xp`
- `level`
- `lives`
- `streak_days`
- `first_touch_*` attribution from the existing helper

Send these on every gameplay event where available:

- `mode`: `level` or `tournament`
- `round_id`
- `level_track`
- `level_number`
- `question_id`
- `question_index`
- `question_count`
- `question_format`
- `category`
- `difficulty`
- `pack`
- `timer_start_sec`
- `time_remaining_sec`
- `response_ms`
- `is_correct`
- `score_delta`
- `score_after`

Send these on every economy event where available:

- `tickets_before`
- `tickets_after`
- `ticket_delta`
- `ticket_reason`
- `xp_before`
- `xp_after`
- `xp_delta`
- `price_usdt`
- `sku`
- `bundle_id`
- `powerup_id`
- `cosmetic_id`
- `reward_type`
- `reward_amount`

## Global App + Providers

### `src/components/providers/AppInitializer.tsx`

Add:

- `app_opened`: already present; add `screen`, `theme_id`, `is_authenticated`, `wallet_connected`.
- `page_viewed`: on route/path changes if v2 can route without full reload.
- `first_touch_attribution_captured`: when first-touch data is newly persisted.
- `miniapp_context_detected`: if runtime/platform context is available.

### `src/hooks/useWalletSignIn.ts`

Add:

- `auth_started`
- `wallet_connect_started`
- `wallet_connect_completed`
- `wallet_connect_failed`
- `auth_nonce_requested`
- `auth_signature_requested`
- `auth_signature_completed`
- `auth_completed`
- `auth_failed`

Properties:

- `provider`
- `chain_id`
- `step`
- `reason`
- `duration_ms`

### `src/app/v2/_app/auto-signin.tsx`

Add:

- `auth_auto_signin_started`
- `auth_auto_signin_completed`
- `auth_auto_signin_failed`
- `auth_auto_signin_skipped`

Properties:

- `reason`: `not_onboarded`, `already_authenticated`, `wallet_unavailable`, `error`

### `src/app/v2/_app/theme.ts`

Add:

- `theme_resolved`
- `theme_override_applied`

Properties:

- `theme_id`
- `source`: `default`, `query`, `local_storage`

### `src/app/v2/_app/sound.ts` and `src/app/v2/_app/shared.tsx`

Add:

- `sound_toggled`
- `bottom_nav_clicked`
- `back_clicked`
- `info_opened`
- `info_closed`
- `sheet_opened`
- `sheet_closed`
- `toast_action_clicked`

Properties:

- `component`
- `target_screen`
- `label`
- `info_title`
- `sheet_name`
- `action`

## App Shell and Screen Routing

### `src/app/v2/_app/page.tsx`

Add:

- `v2_shell_loaded`
- `screen_viewed`
- `daily_reward_auto_opened`
- `world_cup_takeover_auto_opened`
- `coachmark_eligible`

Properties:

- `screen`
- `previous_screen`
- `entry_reason`
- `overlay_active`

### `src/app/v2/_app/state.tsx`

The state provider is the best central client-side place for navigation and gameplay intent.

Add:

- `screen_viewed`: inside `goto`
- `screen_back_clicked`: when `goto(..., { back: true })`
- `level_track_changed`
- `username_set_started`
- `username_set_succeeded`
- `username_set_failed`
- `announcement_dismiss_started`
- `announcement_dismiss_succeeded`
- `announcement_mark_read_started`
- `announcement_mark_read_succeeded`

Gameplay intent events:

- `level_started`
- `level_question_started`
- `question_answer_submitted`
- `question_answer_result`
- `question_timeout`
- `question_next_clicked`
- `level_completed`
- `level_failed`
- `level_retry_clicked`
- `life_lost`
- `lives_refill_started`
- `lives_refill_succeeded`
- `lives_refill_blocked`
- `tournament_entry_started`
- `tournament_entry_succeeded`
- `tournament_entry_blocked`
- `tournament_lobby_entered`
- `tournament_started`
- `tournament_question_started`
- `tournament_score_submitted`
- `tournament_result_local_settled`
- `prize_resolution_started`
- `prize_resolution_succeeded`
- `prize_resolution_failed`
- `powerup_use_started`
- `powerup_use_succeeded`
- `powerup_use_failed`
- `mission_progress_recorded`

Properties:

- `mode`
- `screen`
- `round_id`
- `level_track`
- `level_number`
- `entry_cost`
- `tickets_before`
- `tickets_after`
- `reason`
- `question_id`
- `question_format`
- `is_correct`
- `response_ms`
- `time_remaining_sec`
- `score_after`
- `xp_delta`

## Onboarding + First Run

### `src/app/v2/_app/screens/onboarding.tsx`

Add:

- `onboarding_started`
- `onboarding_slide_viewed`
- `onboarding_slide_next_clicked`
- `onboarding_slide_dot_clicked`
- `onboarding_skipped`
- `onboarding_signup_clicked`
- `onboarding_username_entered`
- `onboarding_completed`
- `onboarding_explore_clicked`
- `onboarding_legal_opened`

Properties:

- `step_index`
- `step_id`
- `total_steps`
- `cta`
- `legal_tab`

### `src/app/v2/_app/screens/world-cup-takeover.tsx`

Add:

- `season_takeover_viewed`
- `season_takeover_dismissed`

Properties:

- `season`
- `theme_id`
- `next_kickoff_minutes`
- `trigger`: `first_visit` or `announcement`

### `src/app/v2/_app/coachmarks.tsx`

Add:

- `coachmark_tour_started`
- `coachmark_step_viewed`
- `coachmark_next_clicked`
- `coachmark_skipped`
- `coachmark_completed`
- `coachmark_reset`

Properties:

- `tour_id`
- `screen`
- `step_index`
- `step_count`
- `target`

## Home

### `src/app/v2/_app/screens/home.tsx`

Add:

- `home_viewed`
- `home_tournament_card_clicked`
- `home_sticky_join_clicked`
- `tournament_entry_confirm_opened`
- `tournament_entry_confirmed`
- `tournament_entry_cancelled`
- `out_of_tickets_sheet_viewed`
- `out_of_tickets_earn_clicked`
- `out_of_tickets_buy_clicked`
- `first_ticket_offer_viewed`
- `first_ticket_offer_buy_clicked`
- `first_ticket_offer_buy_and_play_clicked`
- `daily_reward_chip_clicked`
- `xp_bar_clicked`
- `missions_card_clicked`
- `continue_run_clicked`
- `result_notification_viewed`
- `result_notification_claim_clicked`
- `result_notification_play_next_clicked`
- `result_notification_dismissed`
- `announcement_bell_clicked`

Properties:

- `tickets_balance`
- `entry_cost`
- `round_id`
- `next_kickoff_minutes`
- `daily_bonus_available`
- `first_ticket_offer_available`
- `result_state`
- `winning_amount`

## Levels

### `src/app/v2/_app/screens/levels.tsx`

Add:

- `levels_viewed`
- `level_track_tab_clicked`
- `level_tile_viewed`
- `level_tile_clicked`
- `level_play_clicked`
- `level_scroll_to_current_clicked`
- `levels_back_home_clicked`
- `lives_refill_clicked`
- `level_unlock_animation_viewed`

Properties:

- `level_track`
- `level_number`
- `current_level`
- `is_locked`
- `is_completed`
- `is_current`
- `lives`
- `next_life_in_sec`

### `src/app/v2/_app/screens/level-intro.tsx`

Add:

- `level_intro_viewed`
- `level_intro_begin_clicked`
- `level_intro_back_clicked`

Properties:

- `level_track`
- `level_number`
- `lives`
- `question_count`

### `src/app/v2/_app/screens/question.tsx`

Add:

- `question_screen_viewed`
- `question_presented`
- `answer_option_clicked`
- `answer_multi_toggled`
- `answer_order_changed`
- `answer_order_confirmed`
- `answer_submitted`
- `answer_result_viewed`
- `question_timeout`
- `question_next_clicked`
- `quit_intent_clicked`
- `quit_confirmed`
- `quit_cancelled`
- `live_answerers_viewed`
- `powerup_bar_viewed`
- `powerup_clicked`
- `powerup_applied`
- `powerup_blocked`

Properties:

- `mode`
- `question_id`
- `question_index`
- `question_count`
- `question_format`
- `category`
- `difficulty`
- `answer_count`
- `selected_count`
- `selected_option_hash`
- `is_correct`
- `time_remaining_sec`
- `response_ms`
- `score_after`
- `powerup_id`
- `inventory_before`
- `inventory_after`
- `blocked_reason`

### `src/app/v2/_app/screens/level-result.tsx`

Add:

- `level_win_viewed`
- `level_fail_viewed`
- `level_milestone_viewed`
- `level_retry_clicked`
- `level_continue_clicked`
- `level_back_to_path_clicked`
- `tournament_upsell_viewed`
- `tournament_upsell_enter_clicked`
- `tournament_upsell_keep_practicing_clicked`
- `first_ticket_offer_from_result_viewed`
- `first_ticket_offer_from_result_clicked`

Properties:

- `level_number`
- `level_track`
- `score`
- `correct_count`
- `question_count`
- `xp_delta`
- `tickets_delta`
- `milestone_id`
- `lives_remaining`
- `offer_price_usdt`

## Tournament

### `src/app/v2/_app/screens/lobby.tsx`

Add:

- `lobby_viewed`
- `lobby_leave_clicked`
- `lobby_countdown_completed`
- `tournament_started`

Properties:

- `round_id`
- `field_size_estimate`
- `countdown_sec`
- `theme_id`

### `src/app/v2/_app/screens/results.tsx`

Add:

- `results_viewed`
- `results_waiting_viewed`
- `results_settled_viewed`
- `rank_revealed`
- `near_miss_viewed`
- `prize_wallet_cta_clicked`
- `results_done_clicked`
- `results_play_next_hour_clicked`

Properties:

- `round_id`
- `score`
- `rank`
- `field_size`
- `top_percent`
- `xp_delta`
- `tickets_won`
- `winning_amount`
- `settled`
- `result_state`: `waiting`, `won`, `near_miss`, `lost`

## Compete, Season Pass, Leagues, Leaderboards

### `src/app/v2/_app/screens/compete.tsx`

Add:

- `compete_viewed`
- `league_ladder_viewed`
- `see_ranking_clicked`
- `missions_cta_clicked`
- `vip_rewards_cta_clicked`
- `season_pass_viewed`
- `season_reward_cell_clicked`
- `season_reward_claim_started`
- `season_reward_claim_succeeded`
- `season_reward_claim_failed`
- `premium_reward_clicked`

Properties:

- `season`
- `league`
- `rank`
- `season_pass_level`
- `tier`
- `premium`
- `reward_type`
- `reward_amount`
- `reason`

### `src/app/v2/_app/screens/leagues.tsx`

Add:

- `leagues_viewed`
- `league_card_viewed`
- `league_reward_ladder_viewed`
- `leagues_back_clicked`

Properties:

- `current_league`
- `league`
- `promotion_cutoff`
- `reward_tier`

### `src/app/v2/_app/screens/leaderboard.tsx`

Add:

- `leaderboard_viewed`
- `leaderboard_tab_changed`
- `about_leagues_clicked`
- `points_info_opened`
- `invite_friends_clicked`

Properties:

- `tab`: `league` or `friends`
- `rank`
- `league`
- `points`
- `friend_count`

## Missions + Partner Offers

### `src/app/v2/_app/screens/missions.tsx`

Add:

- `missions_viewed`
- `missions_tab_changed`
- `daily_mission_viewed`
- `daily_mission_claim_state_viewed`
- `partner_offer_viewed`
- `partner_offer_clicked`
- `partner_offer_claim_started`
- `partner_offer_claim_succeeded`
- `partner_offer_claim_failed`
- `partner_offer_already_claimed`
- `missions_info_opened`
- `missions_back_clicked`

Properties:

- `tab`
- `mission_id`
- `mission_status`
- `mission_progress`
- `mission_goal`
- `xp_reward`
- `offer_slug`
- `brand`
- `tickets_reward`
- `verified`
- `hot`
- `reason`

### `src/lib/v2/missions.ts`

Server event candidates:

- `mission_progressed`
- `mission_completed`
- `mission_xp_awarded`

### `src/lib/v2/partnerOffers.ts`

Server event candidates:

- `partner_offers_loaded`
- `partner_offer_claim_attempted`
- `partner_offer_claim_succeeded`
- `partner_offer_claim_rejected`

Properties:

- `offer_slug`
- `tickets_reward`
- `reason`: `missing`, `already`

## Daily Reward + Retention

### `src/app/v2/_app/screens/daily-reward.tsx`

Add:

- `daily_reward_sheet_viewed`
- `daily_reward_claim_started`
- `daily_reward_claim_succeeded`
- `daily_reward_claim_failed`
- `daily_reward_already_claimed`
- `daily_reward_dismissed`
- `streak_freeze_buy_started`
- `streak_freeze_buy_succeeded`
- `streak_freeze_buy_blocked`
- `streak_freeze_buy_failed`
- `daily_reminder_clicked`

Properties:

- `trigger`: `auto`, `home`, `profile`, `announcement`
- `streak_before`
- `streak_after`
- `reward_type`
- `reward_amount`
- `rarity`
- `used_freeze`
- `freeze_balance`
- `tickets_before`
- `tickets_after`
- `reason`

### `src/lib/v2/economy.ts`

Server event candidates:

- `daily_reward_claim_attempted`
- `daily_reward_claimed`
- `daily_reward_claim_rejected`
- `streak_freeze_purchase_attempted`
- `streak_freeze_purchase_succeeded`
- `streak_freeze_purchase_rejected`
- `inventory_granted`
- `powerup_consumed`
- `shop_purchase_attempted`
- `shop_purchase_succeeded`
- `shop_purchase_failed`
- `bundle_topup_succeeded`
- `bundle_topup_failed`

## Shop + Economy

### `src/app/v2/_app/screens/shop.tsx`

Add:

- `shop_viewed`
- `shop_section_changed`
- `ticket_info_opened`
- `featured_offer_viewed`
- `featured_offer_clicked`
- `featured_offer_activated`
- `first_ticket_offer_viewed`
- `first_ticket_offer_buy_clicked`
- `first_ticket_offer_succeeded`
- `ticket_bundle_clicked`
- `ticket_bundle_sheet_viewed`
- `ticket_bundle_checkout_confirmed`
- `ticket_bundle_checkout_cancelled`
- `ticket_bundle_checkout_succeeded`
- `ticket_bundle_checkout_failed`
- `purchase_shortfall_sheet_viewed`
- `purchase_shortfall_topup_clicked`
- `powerup_card_viewed`
- `powerup_buy_clicked`
- `powerup_purchase_pending`
- `powerup_purchase_undo_clicked`
- `powerup_purchase_committed`
- `powerup_purchase_succeeded`
- `powerup_purchase_failed`
- `cosmetic_card_viewed`
- `cosmetic_preview_opened`
- `cosmetic_preview_color_changed`
- `cosmetic_purchase_clicked`
- `cosmetic_purchase_succeeded`
- `cosmetic_purchase_failed`
- `coming_soon_teaser_viewed`
- `coming_soon_teaser_clicked`

Properties:

- `section`
- `sku`
- `bundle_id`
- `powerup_id`
- `cosmetic_id`
- `price_tickets`
- `price_usdt`
- `tickets_before`
- `tickets_after`
- `shortfall`
- `undo_window_ms`
- `result`
- `reason`

## Profile, Badges, Prize Wallet, Legal

### `src/app/v2/_app/screens/profile.tsx`

Add:

- `profile_viewed`
- `profile_stat_clicked`
- `profile_streak_clicked`
- `badge_grid_viewed`
- `badge_detail_opened`
- `badge_detail_closed`
- `ticket_info_opened`
- `prize_wallet_viewed`
- `prize_claim_started`
- `prize_claim_succeeded`
- `prize_claim_failed`
- `prize_convert_started`
- `prize_convert_succeeded`
- `prize_convert_failed`
- `replay_tutorial_clicked`
- `legal_opened`
- `legal_tab_changed`

Properties:

- `badge_id`
- `badge_status`
- `winning_id`
- `winning_amount`
- `action`
- `legal_tab`

### `src/app/v2/_app/badge-unlock.tsx`

Add:

- `badge_unlocked`
- `badge_unlock_overlay_viewed`
- `badge_unlock_dismissed`

Properties:

- `badge_id`
- `badge_category`
- `unlock_source`

### `src/app/v2/_app/legal.tsx`

Add:

- `legal_sheet_viewed`
- `legal_tab_changed`
- `legal_sheet_closed`
- `support_telegram_clicked`
- `support_email_clicked`

Properties:

- `initial_tab`
- `tab`
- `source_screen`

## Announcements

### `src/app/v2/_app/announcements.tsx`

Add:

- `announcement_banner_viewed`
- `announcement_banner_opened`
- `announcement_banner_dismissed`
- `announcement_inbox_opened`
- `announcement_inbox_closed`
- `announcement_cta_clicked`
- `announcement_marked_read`

Properties:

- `announcement_id`
- `announcement_type`
- `cta_target`
- `source_screen`

### `src/lib/v2/playerState.ts`

Server event candidates:

- `announcement_mark_read_succeeded`
- `announcement_dismiss_succeeded`
- `username_updated`
- `avatar_updated`
- `badge_recorded`
- `ticket_ledger_recorded`
- `level_advanced`
- `life_lost`
- `lives_refilled`
- `winning_resolved`
- `player_state_created`
- `player_state_loaded`

## World Cup Format Lab

### `src/app/v2/_app/world-cup/page.tsx`

Add:

- `format_lab_viewed`
- `format_card_clicked`
- `format_stage_opened`
- `format_stage_exited`

Properties:

- `format_id`
- `format_name`
- `format_engine`
- `section`: `core` or `expansion`
- `deep_linked`

### `src/app/v2/_app/world-cup/components/runner.tsx`

Add:

- `format_question_presented`
- `format_answer_submitted`
- `format_answer_result`
- `format_question_timeout`
- `format_next_clicked`
- `format_completed`
- `format_replayed`

Properties:

- `format_id`
- `format_engine`
- `question_index`
- `question_count`
- `is_correct`
- `time_remaining_sec`
- `score_after`
- `correct_count`

### `src/app/v2/_app/world-cup/components/expansion.tsx`

Add:

- `expansion_format_started`
- `expansion_format_interaction`
- `expansion_format_submitted`
- `expansion_format_completed`
- `expansion_format_exited`

Properties:

- `format_id`
- `format_engine`: `map`, `ordering`, `bingo`
- `interaction_type`
- `items_selected`
- `is_complete`

## Backend Tournament + Economy Services

### `src/lib/v2/rounds.ts`

Add server events:

- `round_entry_attempted`
- `round_entry_succeeded`
- `round_entry_rejected`
- `round_score_submitted`
- `round_score_rejected`
- `round_settlement_started`
- `round_settled`
- `round_entry_settled`
- `round_prize_created`
- `round_entry_forfeited`

Properties:

- `round_id`
- `entry_id`
- `score`
- `rank`
- `field_size`
- `prize_amount`
- `reason`

### `src/app/api/cron/settle-rounds/route.ts`

Add:

- `cron_settle_rounds_started`
- `cron_settle_rounds_succeeded`
- `cron_settle_rounds_failed`
- `cron_settle_rounds_unauthorized`

Properties:

- `rounds_checked`
- `rounds_settled`
- `entries_settled`
- `duration_ms`

### `src/app/api/cron/reconcile-pending-purchases/route.ts`

Add:

- `cron_purchase_reconcile_started`
- `cron_purchase_reconcile_succeeded`
- `cron_purchase_reconcile_failed`
- `cron_purchase_reconcile_unauthorized`

Properties:

- `limit`
- `synced`
- `failed`
- `duration_ms`

### `src/lib/v2/seasonPass.ts`

Add server events:

- `season_pass_loaded`
- `season_reward_claim_attempted`
- `season_reward_claim_succeeded`
- `season_reward_claim_rejected`

Properties:

- `season`
- `tier`
- `premium`
- `reward_type`
- `reward_amount`
- `reason`: `locked`, `already`, `premium`, `invalid`

## Legacy/API Surfaces Still Present

These are outside the primary v2 app loop, but they still affect analytics if reachable.

### Auth APIs

Files:

- `src/app/api/v1/auth/nonce/route.ts`
- `src/app/api/v1/auth/verify/route.ts`
- `src/app/api/v1/auth/logout/route.ts`
- `src/app/api/v1/auth/party-token/route.ts`

Events:

- `api_auth_nonce_requested`
- `api_auth_verify_succeeded`
- `api_auth_verify_failed`
- `api_auth_logout_succeeded`
- `api_party_token_requested`

### Legacy Game APIs

Files:

- `src/app/api/v1/games/[gameId]/answer/route.ts`
- `src/app/api/v1/games/[gameId]/join/route.ts`
- `src/app/api/v1/games/[gameId]/leave/route.ts`
- `src/app/api/v1/games/[gameId]/purchase/route.ts`
- `src/app/api/v1/games/[gameId]/claim/route.ts`
- `src/app/api/v1/games/[gameId]/free-ticket/route.ts`
- `src/app/api/v1/games/[gameId]/leaderboard/route.ts`
- `src/app/api/v1/games/[gameId]/entry/route.ts`
- `src/app/api/v1/games/[gameId]/chat/route.ts`

Events:

- `legacy_game_viewed`
- `legacy_game_join_attempted`
- `legacy_game_join_succeeded`
- `legacy_game_answer_submitted`
- `legacy_game_purchase_started`
- `legacy_game_purchase_succeeded`
- `legacy_game_claim_started`
- `legacy_game_claim_succeeded`
- `legacy_game_left`

### Share/OG Routes

Files:

- `src/app/api/og/joined/route.tsx`
- `src/app/api/og/prize/route.tsx`
- `src/app/api/og/score/route.tsx`

Events:

- `og_share_image_requested`
- `og_share_image_failed`

Properties:

- `share_type`: `joined`, `prize`, `score`
- `theme`
- `has_required_params`

### Notifications/Webhook

File:

- `src/app/api/webhook/notify/route.ts`

Events:

- `notification_webhook_received`
- `notification_webhook_verified`
- `notification_webhook_rejected`
- `notification_handler_succeeded`
- `notification_welcome_sent`
- `notification_welcome_failed`

Properties:

- `event_type`
- `has_notification_details`
- `success`
- `reason`

### Upload/Admin/Internal APIs

Files:

- `src/app/api/upload/route.ts`
- `src/app/api/v1/admin/contract/route.ts`
- `src/app/api/v1/admin/games/[gameId]/sponsorship/sync/route.ts`
- `src/app/api/v1/internal/games/[gameId]/notify/route.ts`
- `src/app/api/v1/internal/games/[gameId]/roundup/route.ts`
- `src/app/api/v1/internal/games/end-current-minipay-celo/route.ts`
- `src/app/api/v1/internal/sample-questions/route.ts`

Events:

- `api_upload_started`
- `api_upload_succeeded`
- `api_upload_failed`
- `admin_contract_requested`
- `admin_sponsorship_sync_started`
- `admin_sponsorship_sync_succeeded`
- `internal_game_notify_started`
- `internal_game_roundup_started`
- `internal_game_roundup_succeeded`
- `internal_sample_questions_requested`

## Core Funnels To Build in Umami

### First-Run Activation

`app_opened -> season_takeover_viewed -> onboarding_started -> auth_completed -> username_set_succeeded -> level_intro_viewed -> level_started -> level_completed`

Watch:

- Onboarding skip rate
- Wallet auth failure rate
- First level completion rate
- Time to first completed level

### Solo to Tournament Conversion

`level_completed -> tournament_upsell_viewed -> tournament_upsell_enter_clicked -> first_ticket_offer_viewed -> first_ticket_offer_succeeded -> tournament_entry_succeeded`

Watch:

- Upsell CTR
- First-ticket offer conversion
- Ticket shortfall rate
- Drop-off at confirmation sheet

### Hourly Tournament Loop

`home_tournament_card_clicked -> tournament_entry_confirmed -> tournament_entry_succeeded -> lobby_viewed -> tournament_started -> tournament_question_started -> tournament_score_submitted -> results_viewed`

Watch:

- Entry success rate
- Lobby abandonment
- Question completion rate
- Score submission failures
- Result page return rate

### Prize Wallet

`round_settled -> result_notification_viewed -> result_notification_claim_clicked -> profile_viewed -> prize_claim_started -> prize_claim_succeeded`

Watch:

- Winners who see their result
- Claim intent rate
- Claim success/failure rate
- Convert-to-ticket rate

### Daily Retention

`app_opened -> daily_reward_sheet_viewed -> daily_reward_claim_succeeded -> app_opened_next_day`

Watch:

- Daily reward claim rate
- Streak continuation
- Freeze purchase rate
- Next-day return by streak length

### Shop Monetization Intent

`shop_viewed -> ticket_bundle_clicked -> ticket_bundle_sheet_viewed -> ticket_bundle_checkout_confirmed -> ticket_bundle_checkout_succeeded`

Watch:

- Shop tab usage
- Bundle interest
- Checkout completion
- Shortfall recovery
- Powerup and cosmetic purchase intent

### Missions and Partner Offers

`missions_viewed -> missions_tab_changed(partner) -> partner_offer_clicked -> partner_offer_claim_succeeded`

Watch:

- Partner tab CTR
- Offer claim rate
- Hot/verified offer performance
- Mission completion contribution to XP

## Dashboards

### Activation Dashboard

- App opens
- Onboarding started/completed/skipped
- Auth started/completed/failed
- Username setup
- First level start/completion
- First tournament entry

### Gameplay Quality Dashboard

- Question answer rate
- Timeout rate
- Accuracy by category/difficulty/format
- Average response time
- Level win/fail rate
- Lives lost/refilled
- Powerup usage by question format

### Tournament Health Dashboard

- Entries per hourly round
- Entry block reasons
- Lobby abandonment
- Field size
- Score distribution
- Settlement latency
- Prize creation count/value
- Result page views

### Economy Dashboard

- Tickets earned/spent by reason
- Daily rewards claimed
- Mission XP awarded
- Partner offer tickets awarded
- Season pass claims
- Bundle top-ups
- Powerup/cosmetic spend

### Retention Dashboard

- Daily active users
- Returning users
- Streak distribution
- Daily reward open/claim rate
- Coachmark completion
- Announcement engagement

### Content Dashboard

- Question accuracy by `question_id`
- Timeout by `question_id`
- Difficulty calibration
- Format Lab completion
- World Cup pack engagement
- Minefield/wrong-answer spikes

## Implementation Priority

### P0: Minimum viable production analytics

1. Central `screen_viewed` in `goto`.
2. Auth funnel in `useWalletSignIn`.
3. Onboarding funnel.
4. Level start/question/answer/result/completion.
5. Tournament entry/lobby/question/score/result.
6. Server-side ticket ledger, round entry, score submit, settlement, prize creation.
7. Shop purchase intent/success/failure.
8. Daily reward claim.

### P1: Product learning

1. Coachmarks.
2. Announcements.
3. Missions and partner offers.
4. Season pass rewards.
5. Leaderboard/leagues.
6. Profile prize wallet.
7. Powerups and cosmetics.

### P2: Growth and operations

1. Share/OG route requests.
2. Notification webhook lifecycle.
3. Legacy API usage detection.
4. Cron success/failure metrics.
5. Format Lab analytics.

## Server Analytics Architecture Needed

The current helper is browser-only because it depends on `window.umami`.

Add one of these production options:

- A server analytics sink that writes structured analytics rows to the database and optionally forwards aggregates to Umami.
- A private `/api/analytics/server-event` route used only by server actions/services with an internal token.
- Direct HTTP forwarding to Umami only if the self-hosted instance exposes a stable server-side event ingestion endpoint for your version.

Use the server sink for authoritative events:

- Ticket changes
- Purchase results
- Round entry
- Score submission
- Settlement
- Prize wallet changes
- Partner offer claims
- Season pass claims
- Daily reward claims

Keep client Umami for product behavior:

- Screen views
- Button clicks
- Sheet opens/closes
- Question interaction timing
- Navigation
- Overlay engagement

## Verification Log

### Initial Read

Read the v2 migration document, current analytics helper, app initializer, auth hook, v2 state provider, app shell, core v2 screens, and backend v2 services. Built the first map from actual app structure rather than guessing from product categories.

### Recheck 1: Interaction Search

Searched for `onClick`, `goto`, `ToastButton`, `InfoButton`, `href`, `localStorage`, timers, sheets, toasts, announcements, daily reward, sound, theme, and coachmark usage. This found additional surfaces:

- `src/app/v2/_app/legal.tsx`
- `src/app/v2/_app/coachmarks.tsx`
- `src/app/v2/_app/theme.ts`
- `src/app/v2/_app/sound.ts`
- `src/app/v2/_app/screens/world-cup-takeover.tsx`
- `src/app/v2/_app/world-cup/page.tsx`
- `src/app/v2/_app/world-cup/components/runner.tsx`
- `src/app/v2/_app/world-cup/components/expansion.tsx`

### Recheck 2: Route and Service Inventory

Listed all files under `src/app/v2`, `src/app/api`, `src/lib/v2`, `src/components/providers`, and `src/hooks`. This added non-screen surfaces:

- Cron settlement and purchase reconciliation
- OG/share image routes
- Upload/admin/internal APIs
- Farcaster notification webhook
- Legacy v1 game/user/auth APIs
- Provider hooks around sound, viewport, timers, pending purchases, profile stats, and contract hooks

### Recheck 3: Backend Outcome Pass

Re-read v2 backend services for authoritative outcomes:

- `src/lib/v2/rounds.ts`
- `src/lib/v2/economy.ts`
- `src/lib/v2/playerState.ts`
- `src/lib/v2/missions.ts`
- `src/lib/v2/partnerOffers.ts`
- `src/lib/v2/seasonPass.ts`

This added the server-side events required to reconcile client intent with real game/economy state.

## Final Coverage Checklist

- App open and attribution: covered.
- Auth and auto-sign-in: covered.
- Onboarding and legal consent links: covered.
- World Cup takeover: covered.
- Screen navigation and bottom tabs: covered.
- Home tournament entry and result notification: covered.
- Level path, intro, questions, win/fail: covered.
- Tournament lobby, questions, results, settlement: covered.
- Powerups: covered.
- Daily reward and streak freeze: covered.
- Missions and partner offers: covered.
- Compete, leagues, leaderboard, season pass: covered.
- Shop, bundles, first ticket, cosmetics, powerups: covered.
- Profile, badges, prize wallet, tutorial replay: covered.
- Announcements: covered.
- Coachmarks: covered.
- Sound/theme/shared UI: covered.
- World Cup Format Lab: covered.
- Cron jobs and server services: covered.
- Legacy APIs, webhooks, upload/admin/internal routes, OG share routes: covered.
