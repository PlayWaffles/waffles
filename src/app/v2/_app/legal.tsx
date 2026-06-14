"use client";

import { useState } from "react";
import { Sheet } from "./shared";

// Tabbed legal/support sheet (Terms · Privacy · Support). Content borrowed from
// the waffles-celo legal pages. Opened from the onboarding consent line (and any
// other "Terms / Privacy / Support" link) at a chosen starting tab.

export type LegalTab = "terms" | "privacy" | "support";

type Section = { title: string; body: string };

const TERMS: { intro: string; sections: Section[] } = {
  intro:
    "Effective May 7, 2026. Waffles is operated by the Waffles team. By using the app, you agree to these terms and the game rules shown in the app.",
  sections: [
    { title: "Service", body: "Waffles is a skill-based trivia game operated by the Waffles team. Players join scheduled games, answer timed questions, and may win prizes based on the final leaderboard and the rules shown in the app." },
    { title: "Payments", body: "Ticket payments are made in USDT digital dollars. Network fees may apply." },
    { title: "Prizes", body: "Prize eligibility, ranking, and payout amounts are calculated from the game rules, score data, and final leaderboard. A prize can only be claimed by the eligible account or wallet recorded for that game." },
    { title: "Refunds", body: "If a payment succeeds but your ticket is not credited, contact support with the transaction hash. We will verify the transaction and either credit the ticket, recover the entry, or explain why it is not eligible." },
    { title: "Fair play", body: "Do not automate gameplay, tamper with requests, exploit bugs, use another person's payment method, or interfere with other players. We may block accounts, cancel suspicious entries, or pause a game to protect players and the service." },
    { title: "Availability", body: "Games, schedules, prize pools, and features may change. We try to keep Waffles available, but outages, wallet issues, network congestion, or maintenance can affect access." },
    { title: "Support", body: "For ticket recovery, prize claims, deposit problems, or account help, use the in-app support tab. Critical issues are reviewed with a 24 hour response target." },
  ],
};

const PRIVACY: { intro: string; sections: Section[] } = {
  intro:
    "Effective May 7, 2026. Waffles is operated by the Waffles team. We collect the information needed to run games, recover tickets, display leaderboards, prevent abuse, and support players.",
  sections: [
    { title: "Operator", body: "Waffles is operated by the Waffles team." },
    { title: "Information we use", body: "We may process your app profile, wallet address, game entries, answers, scores, ticket payments, prize claims, support messages, and basic analytics events." },
    { title: "Why we use it", body: "We use this information to run games, credit tickets, calculate leaderboards, verify payments, process prize claims, prevent abuse, troubleshoot bugs, improve the app, and respond to support requests." },
    { title: "Payments and public networks", body: "Payments and prize claims may be recorded on public blockchain networks. Transaction hashes, wallet addresses, contract interactions, and timestamps may be visible through public explorers." },
    { title: "Service providers", body: "We use providers for hosting, analytics, realtime game updates, media storage, wallet infrastructure, and support. They only receive the information needed to provide their services to Waffles." },
    { title: "Retention", body: "We keep game, ticket, payment, and prize records for as long as needed to operate Waffles, resolve disputes, prevent abuse, and meet audit or compliance needs." },
    { title: "Your choices", body: "You can contact support to ask about your account data, report an issue, or request help with a ticket or prize record. Some blockchain records cannot be deleted because they are maintained by public networks." },
    { title: "Security", body: "We use technical and operational safeguards to protect account and game data. No internet service can guarantee perfect security, so report suspicious activity through support." },
  ],
};

const SUPPORT_CHECKLIST = [
  "Your Waffles username.",
  "The game number or ticket screen you need help with.",
  "A transaction link or hash if money moved.",
  "A short description of what happened.",
];

const TABS: { id: LegalTab; label: string }[] = [
  { id: "terms", label: "Terms" },
  { id: "privacy", label: "Privacy" },
  { id: "support", label: "Support" },
];

const titleStyle = { fontFamily: "var(--font-display)", fontSize: 15, color: "var(--ink)", lineHeight: 1.15, marginBottom: 4 } as const;
const bodyStyle = { fontSize: 13, fontWeight: 600, color: "var(--ink-mute)", lineHeight: 1.5 } as const;

const Doc = ({ intro, sections }: { intro: string; sections: Section[] }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <p style={{ ...bodyStyle, color: "var(--ink-faint)" }}>{intro}</p>
    {sections.map((s) => (
      <section key={s.title}>
        <h3 style={titleStyle}>{s.title}</h3>
        <p style={bodyStyle}>{s.body}</p>
      </section>
    ))}
  </div>
);

const SupportDoc = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <p style={{ ...bodyStyle, color: "var(--ink-faint)" }}>
      Need help with a ticket, prize, deposit, or account issue? Contact the
      Waffles team and include enough detail for us to find the game or payment
      quickly.
    </p>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <a
        href="https://t.me/+QTFub8AHqQRmMDlk"
        target="_blank"
        rel="noopener noreferrer"
        style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)", padding: "14px 16px", fontFamily: "var(--font-display)", fontSize: 14, color: "var(--ink)", textDecoration: "none" }}
      >
        Telegram: Waffles Support Group
      </a>
      <a
        href="mailto:support@playwaffles.fun"
        style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)", padding: "14px 16px", fontFamily: "var(--font-display)", fontSize: 14, color: "var(--ink)", textDecoration: "none" }}
      >
        Email: support@playwaffles.fun
      </a>
    </div>
    <section>
      <h3 style={titleStyle}>Include</h3>
      <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
        {SUPPORT_CHECKLIST.map((item) => (
          <li key={item} style={bodyStyle}>{item}</li>
        ))}
      </ul>
    </section>
    <section>
      <h3 style={titleStyle}>Response target</h3>
      <p style={bodyStyle}>
        Critical issues that block tickets, deposits, or prize claims are
        reviewed within 24 hours. General questions are handled as soon as
        possible.
      </p>
    </section>
  </div>
);

export const LegalSheet = ({ initialTab = "terms", onClose }: { initialTab?: LegalTab; onClose: () => void }) => {
  const [tab, setTab] = useState<LegalTab>(initialTab);

  return (
    <Sheet ariaLabel="Legal and support" onClose={onClose} zIndex={120}>
      {(close) => (
      <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "var(--ink)" }}>
          {TABS.find((t) => t.id === tab)?.label}
        </div>
        <button type="button" onClick={close} aria-label="Close" style={{ fontSize: 13, fontWeight: 800, color: "var(--ink-faint)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          Close
        </button>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Legal sections" style={{ display: "flex", gap: 6, padding: 4, borderRadius: 12, background: "rgba(0,0,0,.25)", marginBottom: 14 }}>
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 9,
                border: "none",
                cursor: on ? "default" : "pointer",
                background: on ? "var(--maple-500)" : "transparent",
                color: on ? "var(--frame)" : "var(--ink-mute)",
                fontFamily: "var(--font-display)",
                fontSize: 13,
                transition: "background .2s ease, color .2s ease",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Scrollable content */}
      <div style={{ maxHeight: "56vh", overflowY: "auto", WebkitOverflowScrolling: "touch", paddingRight: 2 }}>
        {tab === "terms" && <Doc intro={TERMS.intro} sections={TERMS.sections} />}
        {tab === "privacy" && <Doc intro={PRIVACY.intro} sections={PRIVACY.sections} />}
        {tab === "support" && <SupportDoc />}
      </div>
      </>
      )}
    </Sheet>
  );
};
