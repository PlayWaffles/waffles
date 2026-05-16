Minipay Submission

## App URLs

- Production app: `https://playwaffles.fun`
- In-app support: `https://playwaffles.fun/support`
- Terms: `https://playwaffles.fun/terms`
- Privacy: `https://playwaffles.fun/privacy`
- MiniPay deposit deeplink: `https://minipay.opera.com/add_cash`

## External origins

These are the origins the app may use in production. Keep this list in sync with
environment config and app integrations before each MiniPay submission.

- `https://playwaffles.fun` - Waffles app, API routes, static assets, OG images.
- `https://forno.celo.org` - Celo mainnet RPC for MiniPay transactions.
- `https://minipay.opera.com` - MiniPay deposit deeplink.
- `https://eu.i.posthog.com` - product analytics.
- `https://waffles-party.chukwukap.partykit.dev` - live game and chat realtime transport.
- `https://res.cloudinary.com` - hosted media assets.
- `https://api.cloudinary.com` - admin media uploads.
- `https://api.neynar.com` - Farcaster profile/notification support for non-MiniPay runtime.
- `https://calendar.google.com` - optional calendar add link after ticket purchase.
- `https://outlook.live.com` - optional calendar add link after ticket purchase.
- `https://t.me` - support contact link.
- `mailto:support@playwaffles.fun` - support contact link.

## Performance evidence

Run PageSpeed Insights against the production URL after deployment and paste the
mobile result here.

- PageSpeed mobile score: `54`
- PageSpeed report URL: `https://pagespeed.web.dev/analysis/https-miniapp-playwaffles-fun/iwn4l71ptr?form_factor=mobile`
- Tested URL: `https://playwaffles.fun/game`
- Tested viewport requirement: `360w x 640h`
- Captured at: `May 7, 2026, 2:55 PM GMT+1`
- Lighthouse environment: `Moto G Power emulation, Slow 4G throttling, Lighthouse 13.0.1`
- Mobile metrics:
  - First Contentful Paint: `1.1 s`
  - Largest Contentful Paint: `8.6 s`
  - Total Blocking Time: `550 ms`
  - Cumulative Layout Shift: `0.104`
  - Speed Index: `5.2 s`
- Other scores:
  - Accessibility: `100`
  - Best Practices: `96`
  - SEO: `100`
