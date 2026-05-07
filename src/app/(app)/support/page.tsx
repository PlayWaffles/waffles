import Link from "next/link";

export const metadata = {
  title: "Support | Waffles",
};

const supportChecklist = [
  "Your Waffles username or MiniPay phone profile name.",
  "The game number or ticket screen you need help with.",
  "A transaction link or transaction hash if money moved.",
  "A short description of what happened.",
];

export default function SupportPage() {
  return (
    <main className="flex-1 overflow-auto px-4 py-6">
      <section className="mx-auto flex w-full max-w-md flex-col gap-5">
        <Link href="/profile" className="font-display text-sm text-white/55">
          Back to profile
        </Link>

        <div className="space-y-3">
          <h1 className="font-body text-[30px] leading-none text-white">Support</h1>
          <p className="font-display text-sm leading-6 text-white/60">
            Need help with a ticket, prize, deposit, or account issue? Contact
            the Waffles team and include enough detail for us to find the game or
            payment quickly.
          </p>
        </div>

        <div className="grid gap-3">
          <a
            href="https://t.me/thecyberverse"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 font-display text-sm text-white"
          >
            Telegram: @thecyberverse
          </a>
          <a
            href="mailto:support@playwaffles.fun"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 font-display text-sm text-white"
          >
            Email: support@playwaffles.fun
          </a>
        </div>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="font-body text-xl leading-none text-white">Include</h2>
          <ul className="mt-3 space-y-2 font-display text-sm leading-5 text-white/60">
            {supportChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-2 font-display text-sm leading-6 text-white/60">
          <h2 className="font-body text-xl leading-none text-white">Response target</h2>
          <p>
            Critical MiniPay issues that block tickets, deposits, or prize claims
            are reviewed within 24 hours. General questions are handled as soon as
            possible.
          </p>
        </section>
      </section>
    </main>
  );
}
