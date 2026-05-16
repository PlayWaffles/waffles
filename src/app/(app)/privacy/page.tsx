import Link from "next/link";

export const metadata = {
  title: "Privacy | Waffles",
};

const sections = [
  {
    title: "Operator",
    body: "Waffles is operated by the Waffles team. The app is not operated by Opera or MiniPay.",
  },
  {
    title: "Information we use",
    body: "We may process your app profile, wallet address, MiniPay runtime signals, game entries, answers, scores, ticket payments, prize claims, support messages, and basic analytics events.",
  },
  {
    title: "Why we use it",
    body: "We use this information to run games, credit tickets, calculate leaderboards, verify payments, process prize claims, prevent abuse, troubleshoot bugs, improve the app, and respond to support requests.",
  },
  {
    title: "Payments and public networks",
    body: "MiniPay payments and prize claims may be recorded on public blockchain networks. Transaction hashes, wallet addresses, contract interactions, and timestamps may be visible through Celo explorers and MiniPay-compatible wallets.",
  },
  {
    title: "Service providers",
    body: "We use providers for hosting, analytics, realtime game updates, media storage, wallet infrastructure, and support. These providers only receive the information needed to provide their services to Waffles.",
  },
  {
    title: "Retention",
    body: "We keep game, ticket, payment, and prize records for as long as needed to operate Waffles, resolve disputes, prevent abuse, and meet audit or compliance needs.",
  },
  {
    title: "Your choices",
    body: "You can contact support to ask about your account data, report an issue, or request help with a ticket or prize record. Some blockchain records cannot be deleted by Waffles because they are maintained by public networks.",
  },
  {
    title: "Security",
    body: "We use technical and operational safeguards to protect account and game data. No internet service can guarantee perfect security, so report suspicious activity through support.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="flex-1 overflow-auto px-4 py-6">
      <section className="mx-auto flex w-full max-w-md flex-col gap-5">
        <Link href="/profile" className="font-display text-sm text-white/55">
          Back to profile
        </Link>

        <div className="space-y-3">
          <h1 className="font-body text-[30px] leading-none text-white">Privacy</h1>
          <p className="font-display text-sm leading-6 text-white/60">
            Effective May 7, 2026. Waffles is operated by the Waffles team, not
            Opera or MiniPay. We collect the information needed to run games,
            recover tickets, display leaderboards, prevent abuse, and support
            players.
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
