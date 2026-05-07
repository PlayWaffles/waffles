import Link from "next/link";

export const metadata = {
  title: "Terms | Waffles",
};

const sections = [
  {
    title: "Service",
    body: "Waffles is a skill-based trivia game where players join scheduled games, answer timed questions, and may win prizes based on the final leaderboard and the rules shown in the app.",
  },
  {
    title: "Payments",
    body: "MiniPay ticket payments are made in USDT digital dollars. Network fees may apply and are handled by MiniPay. Waffles does not ask MiniPay users to pay with CELO.",
  },
  {
    title: "Prizes",
    body: "Prize eligibility, ranking, and payout amounts are calculated from the game rules, score data, and final leaderboard. A prize can only be claimed by the eligible account or wallet recorded for that game.",
  },
  {
    title: "Refunds",
    body: "If a payment succeeds but your ticket is not credited, contact support with the transaction hash. We will verify the transaction and either credit the ticket, recover the entry, or explain why the transaction is not eligible.",
  },
  {
    title: "Fair play",
    body: "Do not automate gameplay, tamper with requests, exploit bugs, use another person's payment method, or interfere with other players. We may block accounts, cancel suspicious entries, or pause a game to protect players and the service.",
  },
  {
    title: "Availability",
    body: "Games, schedules, prize pools, and features may change. We try to keep Waffles available, but outages, wallet issues, network congestion, or maintenance can affect access.",
  },
  {
    title: "Support",
    body: "For ticket recovery, prize claims, deposit problems, or account help, use the in-app support page. Critical MiniPay issues are reviewed with a 24 hour response target.",
  },
];

export default function TermsPage() {
  return (
    <main className="flex-1 overflow-auto px-4 py-6">
      <section className="mx-auto flex w-full max-w-md flex-col gap-5">
        <Link href="/profile" className="font-display text-sm text-white/55">
          Back to profile
        </Link>

        <div className="space-y-3">
          <h1 className="font-body text-[30px] leading-none text-white">Terms</h1>
          <p className="font-display text-sm leading-6 text-white/60">
            Effective May 7, 2026. Waffles is operated by the Waffles team. By
            using the app, you agree to these terms and the game rules shown in
            the app.
          </p>
        </div>

        <div className="space-y-4">
          {sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="font-body text-xl leading-none text-white">
                {section.title}
              </h2>
              <p className="font-display text-sm leading-6 text-white/60">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
